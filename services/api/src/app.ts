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
import { pluginRoutes } from './routes/plugins';
import { webhookRoutes } from './routes/webhooks';
import { integrationRoutes } from './routes/integrations';
import { automationRoutes } from './routes/automation';
import { featureFlagRoutes } from './routes/feature-flags';
import { developerKeyRoutes } from './routes/developer-keys';
import { metricsRoutes } from './routes/metrics';
import { rateLimitRoutes } from './routes/rate-limits';
import { permissionAuditRoutes } from './routes/permission-audit';
import { systemAlertRoutes } from './routes/system-alerts';
import { completionRoutes } from './routes/completion';
import { questionBankRoutes } from './routes/question-bank';
import { quizRoutes } from './routes/quizzes';
import { calendarRoutes } from './routes/calendar';
import { lessonRoutes } from './routes/lessons';
import { choiceRoutes } from './routes/choices';
import { glossaryRoutes } from './routes/glossary';
import { workshopRoutes } from './routes/workshops';
import { wikiRoutes } from './routes/wikis';
import { attendanceRoutes } from './routes/attendance';
import { courseCopyRoutes, backupJobRoutes } from './routes/backup';
import { courseTemplateRoutes } from './routes/course-templates';
import {
  competencyFrameworkRoutes,
  competencyRoutes,
  competencyCrudRoutes,
  competencyMappingRoutes,
  competencyEvidenceRoutes,
  competencyProfileRoutes,
} from './routes/competencies';
import { programmeRoutes } from './routes/programmes';

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
        description: `Ako Learning Management System REST API — multi-tenant, API-first LMS built with Fastify and TypeScript.

**Authentication**: All endpoints (except \`/auth/*\` and \`/health\`) require a Bearer JWT.

Obtain a token via \`POST /api/v1/auth/token\`, then click **Authorize** and paste your token.`,
        version: '1.0.0',
        contact: { name: 'Ako LMS', url: 'https://github.com/ittytheitstar/Ako' },
        license: { name: 'MIT' },
      },
      servers: [
        { url: 'http://localhost:8080', description: 'Local development' },
      ],
      tags: [
        { name: 'Auth', description: 'Authentication and token management' },
        { name: 'Users', description: 'User management' },
        { name: 'Tenants', description: 'Tenant management' },
        { name: 'Roles', description: 'Role and permission management' },
        { name: 'Courses', description: 'Course CRUD, sections, modules' },
        { name: 'Cohorts', description: 'Cohort management' },
        { name: 'Enrolments', description: 'Course enrolments' },
        { name: 'Forums', description: 'Discussion forums and threads' },
        { name: 'Assignments', description: 'Assignment submissions and grading' },
        { name: 'Gradebook', description: 'Grade items, categories and grades' },
        { name: 'Messages', description: 'Direct messaging' },
        { name: 'Notifications', description: 'Notifications and announcements' },
        { name: 'Announcements', description: 'Course and system announcements' },
        { name: 'Presence', description: 'Online presence heartbeat' },
        { name: 'Terms', description: 'Academic terms' },
        { name: 'Archive', description: 'Course archiving' },
        { name: 'Retention', description: 'Retention policies' },
        { name: 'Reports', description: 'Enrolment and activity reports' },
        { name: 'Exports', description: 'Data exports' },
        { name: 'Audit', description: 'Audit log' },
        { name: 'Plugins', description: 'Plugin registry' },
        { name: 'Webhooks', description: 'Webhook management' },
        { name: 'Integrations', description: 'External integrations' },
        { name: 'Automation', description: 'Automation rules' },
        { name: 'Feature Flags', description: 'Feature flag management' },
        { name: 'Developer', description: 'Developer API keys' },
        { name: 'Metrics', description: 'System metrics and observability' },
        { name: 'Rate Limits', description: 'Rate limit management' },
        { name: 'Permission Audit', description: 'Permission audit log' },
        { name: 'System Alerts', description: 'System alert management' },
        { name: 'Completion', description: 'Module and course completion tracking' },
        { name: 'Question Bank', description: 'Question bank categories and questions' },
        { name: 'Quizzes', description: 'Quiz management and attempts' },
        { name: 'Calendar', description: 'Calendar events and iCal sync' },
        { name: 'Lessons', description: 'Lesson activities' },
        { name: 'Choices', description: 'Choice/poll activities' },
        { name: 'Glossary', description: 'Glossary entries' },
        { name: 'Workshops', description: 'Workshop peer-review activities' },
        { name: 'Wikis', description: 'Wiki pages' },
        { name: 'Attendance', description: 'Attendance sessions and records' },
        { name: 'Course Copy', description: 'Async course copy jobs' },
        { name: 'Course Templates', description: 'Template library management' },
        { name: 'Backup', description: 'Backup and restore jobs' },
        { name: 'Competency Frameworks', description: 'Competency framework CRUD and import/export' },
        { name: 'Competencies', description: 'Competency node management' },
        { name: 'Competency Mapping', description: 'Course and activity competency mapping' },
        { name: 'Competency Evidence', description: 'Evidence collection and learner profiles' },
        { name: 'Programmes', description: 'Programme definition and attainment reports' },
        { name: 'SCIM', description: 'SCIM 2.0 user provisioning' },
        { name: 'Health', description: 'Health probes' },
        { name: 'Files', description: 'File uploads' },
        { name: 'LTI', description: 'LTI tool integrations' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Obtain a JWT from POST /api/v1/auth/token and paste it here.',
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/api/v1/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
    staticCSP: true,
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

  // Phase 5 routes
  await fastify.register(pluginRoutes, { prefix: '/api/v1/plugins' });
  await fastify.register(webhookRoutes, { prefix: '/api/v1/webhooks' });
  await fastify.register(integrationRoutes, { prefix: '/api/v1/integrations' });
  await fastify.register(automationRoutes, { prefix: '/api/v1/automation-rules' });
  await fastify.register(featureFlagRoutes, { prefix: '/api/v1/feature-flags' });
  await fastify.register(developerKeyRoutes, { prefix: '/api/v1/developer/keys' });

  // Phase 6 routes
  await fastify.register(metricsRoutes, { prefix: '/api/v1' });
  await fastify.register(rateLimitRoutes, { prefix: '/api/v1/rate-limits' });
  await fastify.register(permissionAuditRoutes, { prefix: '/api/v1/permission-audit' });
  await fastify.register(systemAlertRoutes, { prefix: '/api/v1/system-alerts' });

  // Phase 8 routes
  await fastify.register(completionRoutes, { prefix: '/api/v1/completion' });

  // Phase 9 routes
  await fastify.register(questionBankRoutes, { prefix: '/api/v1/question-bank' });
  await fastify.register(quizRoutes, { prefix: '/api/v1/quizzes' });

  // Phase 10 routes
  await fastify.register(calendarRoutes, { prefix: '/api/v1/calendar' });

  // Phase 11 routes
  await fastify.register(lessonRoutes, { prefix: '/api/v1/lessons' });
  await fastify.register(choiceRoutes, { prefix: '/api/v1/choices' });
  await fastify.register(glossaryRoutes, { prefix: '/api/v1/glossary' });
  await fastify.register(workshopRoutes, { prefix: '/api/v1/workshops' });
  await fastify.register(wikiRoutes, { prefix: '/api/v1/wikis' });
  await fastify.register(attendanceRoutes, { prefix: '/api/v1/attendance' });

  // Phase 12 routes
  await fastify.register(courseCopyRoutes, { prefix: '/api/v1/courses' });
  await fastify.register(courseTemplateRoutes, { prefix: '/api/v1/course-templates' });
  await fastify.register(backupJobRoutes, { prefix: '/api/v1' });

  // Phase 13 routes
  await fastify.register(competencyFrameworkRoutes, { prefix: '/api/v1/competency-frameworks' });
  await fastify.register(competencyRoutes, { prefix: '/api/v1/competency-frameworks' });
  await fastify.register(competencyCrudRoutes, { prefix: '/api/v1/competencies' });
  await fastify.register(competencyMappingRoutes, { prefix: '/api/v1' });
  await fastify.register(competencyEvidenceRoutes, { prefix: '/api/v1/competency-evidence' });
  await fastify.register(competencyProfileRoutes, { prefix: '/api/v1/users' });
  await fastify.register(programmeRoutes, { prefix: '/api/v1/programmes' });

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
