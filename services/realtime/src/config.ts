import { z } from 'zod';

const envSchema = z.object({
  NATS_URL: z.string().default('nats://localhost:4222'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(8090),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Config = z.infer<typeof envSchema>;

const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error('Invalid configuration:', result.error.format());
  process.exit(1);
}
export const config = result.data;
