import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const programmeCreateSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  framework_id: z.string().uuid().optional(),
  course_ids: z.array(z.string().uuid()).optional().default([]),
  settings: z.record(z.unknown()).optional().default({}),
});

const programmeUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  description: z.string().optional(),
  framework_id: z.string().uuid().optional().nullable(),
  course_ids: z.array(z.string().uuid()).optional(),
  settings: z.record(z.unknown()).optional(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function programmeRoutes(fastify: FastifyInstance) {
  // ── List programmes ────────────────────────────────────────────────────────

  fastify.get('/', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Programmes'],
      summary: 'List programmes',
      security: [{ bearerAuth: [] }],
      response: {
        200: { type: 'object', properties: { data: { type: 'array' } } },
      },
    },
  }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT p.*, f.name AS framework_name
       FROM programmes p
       LEFT JOIN competency_frameworks f ON f.framework_id = p.framework_id
       WHERE p.tenant_id = $1
       ORDER BY p.created_at DESC`,
      [request.tenantId]
    );
    return reply.send({ data: rows });
  });

  // ── Create programme ───────────────────────────────────────────────────────

  fastify.post('/', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Programmes'],
      summary: 'Create a programme',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'code'],
        properties: {
          name: { type: 'string' },
          code: { type: 'string' },
          description: { type: 'string' },
          framework_id: { type: 'string', format: 'uuid' },
          course_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
          settings: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    const body = programmeCreateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO programmes (tenant_id, name, code, description, framework_id, course_ids, settings, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        request.tenantId, body.data.name, body.data.code,
        body.data.description ?? null, body.data.framework_id ?? null,
        body.data.course_ids, JSON.stringify(body.data.settings),
        request.user.sub,
      ]
    );
    return reply.status(201).send(rows[0]);
  });

  // ── Get programme ──────────────────────────────────────────────────────────

  fastify.get('/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Programmes'],
      summary: 'Get a programme with its course list',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT p.*, f.name AS framework_name
       FROM programmes p
       LEFT JOIN competency_frameworks f ON f.framework_id = p.framework_id
       WHERE p.programme_id = $1 AND p.tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Programme not found');

    // Fetch courses
    const programme = rows[0];
    let courses: unknown[] = [];
    if (programme.course_ids && programme.course_ids.length > 0) {
      const { rows: courseRows } = await pool.query(
        `SELECT course_id, title, course_code, status FROM courses
         WHERE course_id = ANY($1) AND tenant_id = $2`,
        [programme.course_ids, request.tenantId]
      );
      courses = courseRows;
    }

    return reply.send({ ...programme, courses });
  });

  // ── Update programme ───────────────────────────────────────────────────────

  fastify.patch('/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Programmes'],
      summary: 'Update a programme',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = programmeUpdateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const { rows } = await pool.query(
      `UPDATE programmes SET
         name         = COALESCE($3, name),
         code         = COALESCE($4, code),
         description  = COALESCE($5, description),
         framework_id = CASE WHEN $6::boolean THEN $7::uuid ELSE framework_id END,
         course_ids   = COALESCE($8, course_ids),
         settings     = COALESCE($9, settings),
         updated_at   = now()
       WHERE programme_id = $1 AND tenant_id = $2 RETURNING *`,
      [
        id, request.tenantId,
        body.data.name ?? null,
        body.data.code ?? null,
        body.data.description ?? null,
        'framework_id' in body.data,
        body.data.framework_id ?? null,
        body.data.course_ids ?? null,
        body.data.settings ? JSON.stringify(body.data.settings) : null,
      ]
    );
    if (rows.length === 0) throw NotFound('Programme not found');
    return reply.send(rows[0]);
  });

  // ── Get programme attainment report ───────────────────────────────────────

  fastify.get('/:id/report', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Programmes'],
      summary: 'Get competency attainment report for a programme',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows: progRows } = await pool.query(
      `SELECT * FROM programmes WHERE programme_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (progRows.length === 0) throw NotFound('Programme not found');

    const { rows } = await pool.query(
      `SELECT r.*, c.short_name AS competency_short_name
       FROM programme_competency_reports r
       JOIN competencies c ON c.competency_id = r.competency_id
       WHERE r.programme_id = $1 AND r.tenant_id = $2
       ORDER BY c.level, c.short_name`,
      [id, request.tenantId]
    );
    return reply.send({ programme: progRows[0], data: rows });
  });

  // ── Refresh programme report ───────────────────────────────────────────────

  fastify.post('/:id/report/refresh', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Programmes'],
      summary: 'Refresh the cached competency attainment report for a programme',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows: progRows } = await pool.query(
      `SELECT * FROM programmes WHERE programme_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (progRows.length === 0) throw NotFound('Programme not found');
    const programme = progRows[0];

    if (!programme.framework_id) {
      return reply.send({ refreshed: 0, message: 'Programme has no framework assigned' });
    }

    // Get all competencies for the framework
    const { rows: compRows } = await pool.query(
      `SELECT competency_id FROM competencies WHERE framework_id = $1 AND tenant_id = $2`,
      [programme.framework_id, request.tenantId]
    );

    // Get all learners enrolled in programme courses
    const courseIds: string[] = programme.course_ids ?? [];
    if (courseIds.length === 0) {
      return reply.send({ refreshed: 0, message: 'Programme has no courses' });
    }

    const { rows: learnerRows } = await pool.query(
      `SELECT DISTINCT user_id FROM enrolments
       WHERE course_id = ANY($1) AND tenant_id = $2 AND status = 'active'`,
      [courseIds, request.tenantId]
    );

    const totalLearners = learnerRows.length;
    let refreshed = 0;

    // Fetch all proficiency ratings for programme learners in one query
    const learnerIds = learnerRows.map((r: { user_id: string }) => r.user_id);
    const compIds = compRows.map((r: { competency_id: string }) => r.competency_id);

    const { rows: allProfiles } = learnerIds.length > 0 && compIds.length > 0
      ? await pool.query(
          `SELECT user_id, competency_id, proficiency_rating FROM competency_profiles
           WHERE tenant_id = $1 AND user_id = ANY($2) AND competency_id = ANY($3)`,
          [request.tenantId, learnerIds, compIds]
        )
      : { rows: [] };

    // Build lookup: competencyId → { rating → count }
    const profileMap = new Map<string, Map<string, string>>();
    for (const p of allProfiles as { user_id: string; competency_id: string; proficiency_rating: string }[]) {
      if (!profileMap.has(p.competency_id)) profileMap.set(p.competency_id, new Map());
      profileMap.get(p.competency_id)!.set(p.user_id, p.proficiency_rating);
    }

    for (const comp of compRows) {
      const counts: Record<string, number> = {
        not_yet: 0, beginning: 0, developing: 0, proficient: 0, advanced: 0,
      };
      const compProfiles = profileMap.get(comp.competency_id) ?? new Map<string, string>();

      for (const learner of learnerRows) {
        const rating = (compProfiles.get(learner.user_id) ?? 'not_yet') as string;
        counts[rating] = (counts[rating] ?? 0) + 1;
      }

      const proficientPct = totalLearners > 0
        ? ((counts.proficient + counts.advanced) / totalLearners) * 100
        : 0;

      await pool.query(
        `INSERT INTO programme_competency_reports
           (tenant_id, programme_id, competency_id, total_learners,
            not_yet_count, beginning_count, developing_count, proficient_count, advanced_count, proficient_pct)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (programme_id, competency_id) DO UPDATE SET
           total_learners   = EXCLUDED.total_learners,
           not_yet_count    = EXCLUDED.not_yet_count,
           beginning_count  = EXCLUDED.beginning_count,
           developing_count = EXCLUDED.developing_count,
           proficient_count = EXCLUDED.proficient_count,
           advanced_count   = EXCLUDED.advanced_count,
           proficient_pct   = EXCLUDED.proficient_pct,
           refreshed_at     = now()`,
        [
          request.tenantId, id, comp.competency_id, totalLearners,
          counts.not_yet, counts.beginning, counts.developing,
          counts.proficient, counts.advanced,
          Math.round(proficientPct * 100) / 100,
        ]
      );
      refreshed++;
    }

    return reply.send({ refreshed, total_learners: totalLearners });
  });
}
