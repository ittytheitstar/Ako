import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TokenPayload, Unauthorized } from '@ako/shared';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: TokenPayload;
    user: TokenPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    tenantId: string;
  }
}

export async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate('authenticate', async function (request: FastifyRequest, _reply: FastifyReply) {
    try {
      await request.jwtVerify();
      const payload = request.user as TokenPayload;
      request.tenantId = payload.tenantId;
    } catch {
      throw Unauthorized('Invalid or expired token');
    }
  });
}
