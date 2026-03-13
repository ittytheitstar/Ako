import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { ProblemError } from '@ako/shared';
import { redisPlugin } from './plugins/redis';
import { authPlugin } from './plugins/auth';
import { rbacPlugin } from './plugins/rbac';
import { tenantPlugin } from './plugins/tenant';
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { tenantRoutes } from './routes/tenants';
import { userRoutes } from './routes/users';
import { roleRoutes } from './routes/roles';
import { courseRoutes } from './routes/courses';
import { cohortRoutes } from './routes/cohorts';
import { forumRoutes } from './routes/forums';
import { assignmentRoutes } from './routes/assignments';
import { gradebookRoutes } from './routes/gradebook';
import { messageRoutes } from './routes/messages';
import { fileRoutes } from './routes/files';
import { ltiRoutes } from './routes/lti';
import { scimRoutes } from './routes/scim';
import { notificationRoutes } from './routes/notifications';
import { announcementRoutes } from './routes/announcements';
import { presenceRoutes } from './routes/presence';
import { termRoutes } from './routes/terms';
import { archiveRoutes } from './routes/archive';
import { retentionRoutes } from './routes/retention';
import { reportRoutes } from './routes/reports';
import { exportRoutes } from './routes/exports';
import { auditRoutes } from './routes/audit';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: config.LOG_LEVEL,
    },
  });

  await fastify.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
  });

  await fastify.register(jwt, {
    secret: config.JWT_SECRET,
  });

  await fastify.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
  });

  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Ako LMS API',
        description: 'Ako Learning Management System REST API',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/api/v1/docs',
  });

  await fastify.register(redisPlugin);
  await fastify.register(authPlugin);
  await fastify.register(rbacPlugin);
  await fastify.register(tenantPlugin);

  await fastify.register(healthRoutes, { prefix: '/api/v1' });
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
  await fastify.register(tenantRoutes, { prefix: '/api/v1/tenants' });
  await fastify.register(userRoutes, { prefix: '/api/v1/users' });
  await fastify.register(roleRoutes, { prefix: '/api/v1/roles' });
  await fastify.register(courseRoutes, { prefix: '/api/v1/courses' });
  await fastify.register(cohortRoutes, { prefix: '/api/v1/cohorts' });
  await fastify.register(forumRoutes, { prefix: '/api/v1/forums' });
  await fastify.register(assignmentRoutes, { prefix: '/api/v1/assignments' });
  await fastify.register(gradebookRoutes, { prefix: '/api/v1/gradebook' });
  await fastify.register(messageRoutes, { prefix: '/api/v1/messages' });
  await fastify.register(fileRoutes, { prefix: '/api/v1/files' });
  await fastify.register(ltiRoutes, { prefix: '/api/v1/lti' });
  await fastify.register(scimRoutes, { prefix: '/scim/v2' });
  await fastify.register(notificationRoutes, { prefix: '/api/v1/notifications' });
  await fastify.register(announcementRoutes, { prefix: '/api/v1' });
  await fastify.register(presenceRoutes, { prefix: '/api/v1/presence' });
  await fastify.register(termRoutes, { prefix: '/api/v1/terms' });
  await fastify.register(archiveRoutes, { prefix: '/api/v1/courses' });
  await fastify.register(retentionRoutes, { prefix: '/api/v1/retention-policies' });
  await fastify.register(reportRoutes, { prefix: '/api/v1/reports' });
  await fastify.register(exportRoutes, { prefix: '/api/v1/exports' });
  await fastify.register(auditRoutes, { prefix: '/api/v1/audit' });

  fastify.setErrorHandler((error: unknown, _request, reply) => {
    if (error instanceof ProblemError) {
      return reply.status(error.status).send(error.toJSON());
    }
    const err = error as { statusCode?: number; message?: string };
    if (err.statusCode === 400) {
      return reply.status(400).send({
        type: 'https://ako.invalid/errors/bad-request',
        title: 'Bad Request',
        status: 400,
        detail: err.message,
      });
    }
    fastify.log.error(error);
    return reply.status(500).send({
      type: 'https://ako.invalid/errors/internal-server-error',
      title: 'Internal Server Error',
      status: 500,
    });
  });

  return fastify;
}
