import { Pool } from 'pg';
import { connect, NatsConnection, StringCodec } from 'nats';
import { config } from '../config';
import { DomainEvent } from '@ako/shared';

const sc = StringCodec();
let natsClient: NatsConnection | null = null;

export async function connectNats(): Promise<NatsConnection> {
  natsClient = await connect({ servers: config.NATS_URL });
  return natsClient;
}

export async function publishEvent(event: DomainEvent, nc?: NatsConnection): Promise<void> {
  const client = nc ?? natsClient;
  if (!client) return;
  const subject = `ako.events.${event.type}`;
  client.publish(subject, sc.encode(JSON.stringify(event)));
}

export function startOutboxPoller(pool: Pool, nc: NatsConnection): NodeJS.Timeout {
  return setInterval(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // outbox_events uses topic/payload/published_at columns
      const { rows } = await client.query(
        `SELECT * FROM outbox_events WHERE published_at IS NULL ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED`
      );
      for (const row of rows) {
        try {
          const subject = `ako.events.${row.topic}`;
          nc.publish(subject, sc.encode(JSON.stringify({
            eventId: row.event_id,
            type: row.topic,
            tenantId: row.tenant_id,
            channel: row.key ?? '',
            data: row.payload,
            timestamp: row.created_at,
          })));
          await client.query(
            `UPDATE outbox_events SET published_at = now() WHERE event_id = $1`,
            [row.event_id]
          );
        } catch (err) {
          console.error('Failed to process outbox event', row.event_id, err);
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Outbox poller error', err);
    } finally {
      client.release();
    }
  }, 1000);
}
