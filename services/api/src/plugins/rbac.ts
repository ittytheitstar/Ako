import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Forbidden } from '@ako/shared';

declare module 'fastify' {
  interface FastifyInstance {
    requirePermission: (permission: string) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function rbacPlugin(fastify: FastifyInstance) {
  fastify.decorate('requirePermission', function (permission: string) {
    return async function (request: FastifyRequest, _reply: FastifyReply) {
      const user = request.user as { permissions?: string[] };
      if (!user?.permissions?.includes(permission)) {
        throw Forbidden(`Permission required: ${permission}`);
      }
    };
  });
}
