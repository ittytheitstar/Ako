import type { ChannelMessage, ClientMessage } from '@ako/shared';

const RT_BASE = process.env.NEXT_PUBLIC_RT_BASE ?? 'ws://localhost:8090';

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<(msg: ChannelMessage) => void>>();
  private token: string;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(token: string) {
    this.token = token;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.ws = new WebSocket(`${RT_BASE}/ws?token=${encodeURIComponent(this.token)}`);

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as ChannelMessage;
        if (msg.channel) {
          const fns = this.handlers.get(msg.channel);
          if (fns) fns.forEach(fn => fn(msg));
        }
      } catch {
        // ignore
      }
    };

    this.ws.onclose = () => {
      this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  subscribe(channel: string, handler: (msg: ChannelMessage) => void) {
    if (!this.handlers.has(channel)) this.handlers.set(channel, new Set());
    this.handlers.get(channel)!.add(handler);
    if (this.ws?.readyState === WebSocket.OPEN) {
      const msg: ClientMessage = { type: 'subscribe', channel };
      this.ws.send(JSON.stringify(msg));
    }
    return () => this.unsubscribe(channel, handler);
  }

  unsubscribe(channel: string, handler: (msg: ChannelMessage) => void) {
    this.handlers.get(channel)?.delete(handler);
    if (this.ws?.readyState === WebSocket.OPEN) {
      const msg: ClientMessage = { type: 'unsubscribe', channel };
      this.ws.send(JSON.stringify(msg));
    }
  }

  disconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.ws?.close();
    this.ws = null;
  }
}
