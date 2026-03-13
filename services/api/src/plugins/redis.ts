import { FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import { config } from '../config';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

export async function redisPlugin(fastify: FastifyInstance) {
  const redis = new Redis(config.REDIS_URL);
  redis.on('error', (err) => fastify.log.error({ err }, 'Redis error'));
  fastify.decorate('redis', redis);
  fastify.addHook('onClose', async () => {
    await redis.quit();
  });
}
