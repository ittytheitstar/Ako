import { buildApp } from './app';
import { config } from './config';
import { pool } from './db/client';
import { connectNats, startOutboxPoller } from './events/publisher';

async function main() {
  const app = await buildApp();

  try {
    const nc = await connectNats();
    const poller = startOutboxPoller(pool, nc);

    const gracefulShutdown = async () => {
      clearInterval(poller);
      await app.close();
      await pool.end();
      await nc.drain();
      process.exit(0);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

    await app.listen({ port: config.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
