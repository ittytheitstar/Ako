import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { connect, NatsConnection, StringCodec } from 'nats';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { WebSocket } from 'ws';
import { config } from './config';
import type { TokenPayload, ClientMessage, ChannelMessage, DomainEvent } from '@ako/shared';

const sc = StringCodec();

interface WsClient {
  ws: WebSocket;
  userId: string;
  tenantId: string;
  channels: Set<string>;
}

const clients = new Map<WebSocket, WsClient>();
const channelClients = new Map<string, Set<WebSocket>>();

function broadcast(channel: string, message: ChannelMessage) {
  const subs = channelClients.get(channel);
  if (!subs) return;
  const payload = JSON.stringify(message);
  for (const ws of subs) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function subscribe(ws: WebSocket, channel: string) {
  const client = clients.get(ws);
  if (!client) return;
  client.channels.add(channel);
  if (!channelClients.has(channel)) channelClients.set(channel, new Set());
  channelClients.get(channel)!.add(ws);
  const ack: ChannelMessage = { type: 'subscribed', channel };
  ws.send(JSON.stringify(ack));
}

function unsubscribe(ws: WebSocket, channel: string) {
  const client = clients.get(ws);
  if (client) client.channels.delete(channel);
  const subs = channelClients.get(channel);
  if (subs) subs.delete(ws);
}

function removeClient(ws: WebSocket) {
  const client = clients.get(ws);
  if (!client) return;
  for (const channel of client.channels) {
    const subs = channelClients.get(channel);
    if (subs) subs.delete(ws);
  }
  clients.delete(ws);
}

async function main() {
  const redis = new Redis(config.REDIS_URL);
  let nc: NatsConnection;

  try {
    nc = await connect({ servers: config.NATS_URL });
    console.log('Connected to NATS');
  } catch (err) {
    console.error('Failed to connect to NATS:', err);
    process.exit(1);
  }

  const fastify = Fastify({ logger: { level: config.NODE_ENV === 'development' ? 'info' : 'warn' } });
  await fastify.register(websocket);

  fastify.get('/health', async (_req, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
  });

  fastify.get('/ws', { websocket: true }, (socket, request) => {
    const ws = socket as WebSocket;
    const url = new URL(request.url, `http://localhost`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.send(JSON.stringify({ type: 'error', data: 'Missing token' }));
      ws.close(1008, 'Missing token');
      return;
    }

    let payload: TokenPayload;
    try {
      payload = jwt.verify(token, config.JWT_SECRET) as TokenPayload;
    } catch {
      ws.send(JSON.stringify({ type: 'error', data: 'Invalid token' }));
      ws.close(1008, 'Invalid token');
      return;
    }

    const client: WsClient = {
      ws,
      userId: payload.sub,
      tenantId: payload.tenantId,
      channels: new Set(),
    };
    clients.set(ws, client);

    ws.on('message', async (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientMessage;
        switch (msg.type) {
          case 'subscribe':
            subscribe(ws, msg.channel);
            break;
          case 'unsubscribe':
            unsubscribe(ws, msg.channel);
            break;
          case 'typing':
            await redis.setex(`typing:${msg.channel}:${client.userId}`, 5, '1');
            nc.publish(`ako.typing.${msg.channel}`, sc.encode(JSON.stringify({
              userId: client.userId,
              channel: msg.channel,
              tenantId: client.tenantId,
            })));
            break;
        }
      } catch (err) {
        console.error('WS message error:', err);
      }
    });

    ws.on('close', () => {
      removeClient(ws);
    });

    ws.on('error', (err: Error) => {
      console.error('WS error:', err);
      removeClient(ws);
    });
  });

  fastify.get('/sse', async (request, reply) => {
    const token = (request.headers.authorization ?? '').replace('Bearer ', '');
    const channel = (request.query as { channel?: string }).channel;

    if (!token || !channel) {
      return reply.status(400).send({ error: 'Missing token or channel' });
    }

    let payload: TokenPayload;
    try {
      payload = jwt.verify(token, config.JWT_SECRET) as TokenPayload;
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders();

    const send = (data: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    send({ type: 'subscribed', channel, userId: payload.sub });

    const sub = nc.subscribe(`ako.events.>`);
    const keepAlive = setInterval(() => {
      reply.raw.write(':ping\n\n');
    }, 15000);

    request.raw.on('close', () => {
      clearInterval(keepAlive);
      sub.unsubscribe();
    });

    (async () => {
      for await (const msg of sub) {
        try {
          const event = JSON.parse(sc.decode(msg.data)) as DomainEvent;
          if (event.channel === channel || event.tenantId === payload.tenantId) {
            send({ type: 'event', event: event.type, data: event.data, channel: event.channel });
          }
        } catch {
          // skip malformed events
        }
      }
    })().catch(console.error);

    return reply;
  });

  // Subscribe to NATS for WS fanout
  const eventSub = nc.subscribe('ako.events.>');
  (async () => {
    for await (const msg of eventSub) {
      try {
        const event = JSON.parse(sc.decode(msg.data)) as DomainEvent;
        const channelMsg: ChannelMessage = {
          type: 'event',
          event: event.type,
          channel: event.channel,
          data: event.data,
        };
        broadcast(event.channel, channelMsg);
        broadcast(`tenant:${event.tenantId}`, channelMsg);
      } catch {
        // skip
      }
    }
  })().catch(console.error);

  // Subscribe to typing indicators
  const typingSub = nc.subscribe('ako.typing.>');
  (async () => {
    for await (const msg of typingSub) {
      try {
        const data = JSON.parse(sc.decode(msg.data)) as { userId: string; channel: string };
        const channelMsg: ChannelMessage = {
          type: 'typing',
          channel: data.channel,
          userId: data.userId,
        };
        broadcast(data.channel, channelMsg);
      } catch {
        // skip
      }
    }
  })().catch(console.error);

  const gracefulShutdown = async () => {
    await fastify.close();
    await nc.drain();
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  await fastify.listen({ port: config.PORT, host: '0.0.0.0' });
  console.log(`Realtime service listening on port ${config.PORT}`);
}

main().catch(console.error);
