import { FastifyInstance } from 'fastify';

export async function tenantPlugin(_fastify: FastifyInstance) {
  // tenant extraction is handled by authPlugin via JWT payload
}
