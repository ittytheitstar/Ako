import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const PHASE_ORDER = ['setup', 'submission', 'assessment', 'grading', 'closed'] as const;

const workshopConfigSchema = z.object({
  submission_end_at: z.string().datetime().optional(),
  assessment_end_at: z.string().datetime().optional(),
  peer_count: z.number().int().min(1).default(3),
  submission_weight: z.number().min(0).max(100).default(50),
  assessment_weight: z.number().min(0).max(100).default(50),
  self_assessment: z.boolean().default(false),
  allocation_strategy: z.enum(['random', 'manual']).default('random'),
});

const submissionSchema = z.object({
  title: z.string().min(1),
  body: z.record(z.unknown()).default({}),
});

const assessmentSchema = z.object({
  grades: z.record(z.unknown()),
  feedback: z.string().optional(),
});

export async function workshopRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // ── Workshop config ───────────────────────────────────────────────────────

  fastify.get('/:moduleId', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const { rows } = await pool.query(
      `SELECT * FROM workshops WHERE module_id = $1 AND tenant_id = $2`,
      [moduleId, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Workshop not found');
    return reply.send(rows[0]);
  });

  fastify.put('/:moduleId', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const body = workshopConfigSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const d = body.data;
    const { rows } = await pool.query(
      `INSERT INTO workshops (module_id, tenant_id, submission_end_at, assessment_end_at,
         peer_count, submission_weight, assessment_weight, self_assessment, allocation_strategy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (module_id) DO UPDATE SET
         submission_end_at   = EXCLUDED.submission_end_at,
         assessment_end_at   = EXCLUDED.assessment_end_at,
         peer_count          = EXCLUDED.peer_count,
         submission_weight   = EXCLUDED.submission_weight,
         assessment_weight   = EXCLUDED.assessment_weight,
         self_assessment     = EXCLUDED.self_assessment,
         allocation_strategy = EXCLUDED.allocation_strategy,
         updated_at          = now()
       RETURNING *`,
      [
        moduleId, request.tenantId,
        d.submission_end_at ?? null, d.assessment_end_at ?? null,
        d.peer_count, d.submission_weight, d.assessment_weight,
        d.self_assessment, d.allocation_strategy,
      ]
    );
    return reply.status(200).send(rows[0]);
  });

  // ── Submissions ───────────────────────────────────────────────────────────

  fastify.post('/:moduleId/submissions', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const body = submissionSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const { rows: workshops } = await pool.query(
      `SELECT * FROM workshops WHERE module_id = $1 AND tenant_id = $2`,
      [moduleId, request.tenantId]
    );
    if (workshops.length === 0) throw NotFound('Workshop not found');
    const workshop = workshops[0];
    if (workshop.phase !== 'submission') throw BadRequest('Workshop is not in submission phase');
    if (workshop.submission_end_at && new Date(workshop.submission_end_at) < new Date()) {
      throw BadRequest('Submission deadline has passed');
    }

    const { rows } = await pool.query(
      `INSERT INTO workshop_submissions (workshop_id, tenant_id, author_id, title, body)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [workshop.workshop_id, request.tenantId, request.user.sub, body.data.title, JSON.stringify(body.data.body)]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.get('/:moduleId/submissions', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const { rows: workshops } = await pool.query(
      `SELECT * FROM workshops WHERE module_id = $1 AND tenant_id = $2`,
      [moduleId, request.tenantId]
    );
    if (workshops.length === 0) throw NotFound('Workshop not found');
    const workshop = workshops[0];

    // Return submissions allocated to current user for assessment
    const { rows } = await pool.query(
      `SELECT s.* FROM workshop_submissions s
       JOIN workshop_assessments a ON a.submission_id = s.submission_id
       WHERE s.workshop_id = $1 AND a.assessor_id = $2 AND s.tenant_id = $3`,
      [workshop.workshop_id, request.user.sub, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  // ── Assessments ───────────────────────────────────────────────────────────

  fastify.get('/:moduleId/assessments', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const { rows: workshops } = await pool.query(
      `SELECT * FROM workshops WHERE module_id = $1 AND tenant_id = $2`,
      [moduleId, request.tenantId]
    );
    if (workshops.length === 0) throw NotFound('Workshop not found');
    const workshop = workshops[0];

    const { rows } = await pool.query(
      `SELECT a.*, s.title AS submission_title, s.body AS submission_body
       FROM workshop_assessments a
       JOIN workshop_submissions s ON s.submission_id = a.submission_id
       WHERE a.workshop_id = $1 AND a.assessor_id = $2 AND a.tenant_id = $3`,
      [workshop.workshop_id, request.user.sub, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/:moduleId/assessments/:submissionId', async (request, reply) => {
    const { moduleId, submissionId } = request.params as { moduleId: string; submissionId: string };
    const body = assessmentSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const { rows: workshops } = await pool.query(
      `SELECT * FROM workshops WHERE module_id = $1 AND tenant_id = $2`,
      [moduleId, request.tenantId]
    );
    if (workshops.length === 0) throw NotFound('Workshop not found');
    const workshop = workshops[0];
    if (workshop.phase !== 'assessment') throw BadRequest('Workshop is not in assessment phase');

    const { rows: assessments } = await pool.query(
      `SELECT * FROM workshop_assessments
       WHERE submission_id = $1 AND assessor_id = $2 AND workshop_id = $3`,
      [submissionId, request.user.sub, workshop.workshop_id]
    );
    if (assessments.length === 0) throw NotFound('Assessment not assigned to you');

    // Calculate numeric grade if grades contain numeric values
    const gradeValues = Object.values(body.data.grades).filter((v) => typeof v === 'number') as number[];
    const grade = gradeValues.length > 0
      ? gradeValues.reduce((a, b) => a + b, 0) / gradeValues.length
      : null;

    const { rows } = await pool.query(
      `UPDATE workshop_assessments SET grades = $1, feedback = $2, grade = $3, submitted_at = now()
       WHERE submission_id = $4 AND assessor_id = $5 AND workshop_id = $6
       RETURNING *`,
      [
        JSON.stringify(body.data.grades), body.data.feedback ?? null, grade,
        submissionId, request.user.sub, workshop.workshop_id,
      ]
    );

    await pool.query(
      `INSERT INTO event_outbox (tenant_id, topic, payload) VALUES ($1, $2, $3)`,
      [
        request.tenantId,
        'workshop.assessment.submitted',
        JSON.stringify({ assessment_id: rows[0].assessment_id, workshop_id: workshop.workshop_id }),
      ]
    );

    return reply.send(rows[0]);
  });

  // ── Phase management (teacher only) ───────────────────────────────────────

  fastify.post('/:moduleId/advance', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const { rows: workshops } = await pool.query(
      `SELECT * FROM workshops WHERE module_id = $1 AND tenant_id = $2`,
      [moduleId, request.tenantId]
    );
    if (workshops.length === 0) throw NotFound('Workshop not found');
    const workshop = workshops[0];

    const currentIdx = PHASE_ORDER.indexOf(workshop.phase as typeof PHASE_ORDER[number]);
    if (currentIdx === -1 || currentIdx === PHASE_ORDER.length - 1) {
      throw BadRequest('Workshop is already in its final phase');
    }
    const nextPhase = PHASE_ORDER[currentIdx + 1];

    const { rows } = await pool.query(
      `UPDATE workshops SET phase = $1, updated_at = now()
       WHERE workshop_id = $2 RETURNING *`,
      [nextPhase, workshop.workshop_id]
    );

    await pool.query(
      `INSERT INTO event_outbox (tenant_id, topic, payload) VALUES ($1, $2, $3)`,
      [
        request.tenantId,
        'workshop.phase.advanced',
        JSON.stringify({ workshop_id: workshop.workshop_id, phase: nextPhase }),
      ]
    );

    return reply.send(rows[0]);
  });

  fastify.post('/:moduleId/allocate', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const { rows: workshops } = await pool.query(
      `SELECT * FROM workshops WHERE module_id = $1 AND tenant_id = $2`,
      [moduleId, request.tenantId]
    );
    if (workshops.length === 0) throw NotFound('Workshop not found');
    const workshop = workshops[0];

    if (workshop.allocation_strategy !== 'random') {
      throw BadRequest('Allocation strategy is not random');
    }
    if (!['submission', 'assessment'].includes(workshop.phase)) {
      throw BadRequest('Allocation can only be done during submission or assessment phase');
    }

    // Fetch all submissions
    const { rows: submissions } = await pool.query(
      `SELECT submission_id, author_id FROM workshop_submissions
       WHERE workshop_id = $1 AND tenant_id = $2`,
      [workshop.workshop_id, request.tenantId]
    );
    if (submissions.length < 2) throw BadRequest('Not enough submissions to allocate');

    const peerCount = Math.min(workshop.peer_count, submissions.length - 1);
    let allocated = 0;

    for (const sub of submissions) {
      // Pick peerCount random assessors excluding the author
      const candidates = submissions.filter((s) => s.author_id !== sub.author_id);
      // Fisher-Yates shuffle for unbiased random allocation
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      const assignedPeers = candidates.slice(0, peerCount);
      for (const assessor of assignedPeers) {
        await pool.query(
          `INSERT INTO workshop_assessments (workshop_id, submission_id, tenant_id, assessor_id)
           VALUES ($1, $2, $3, $4) ON CONFLICT (submission_id, assessor_id) DO NOTHING`,
          [workshop.workshop_id, sub.submission_id, request.tenantId, assessor.author_id]
        );
        allocated++;
      }
    }

    return reply.send({ allocated });
  });
}
