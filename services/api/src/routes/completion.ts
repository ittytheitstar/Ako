import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const completionRuleSchema = z.object({
  completion_type: z.enum(['view', 'submit', 'grade', 'post', 'manual', 'teacher']),
  passing_grade: z.number().min(0).max(100).optional(),
  require_view: z.boolean().default(false),
  expected_completion_date: z.string().optional(),
});

const manualCompleteSchema = z.object({
  user_id: z.string().uuid().optional(), // teacher overriding for another user
  state: z.enum(['complete', 'complete_pass', 'complete_fail', 'incomplete']).default('complete'),
  completion_source: z.enum(['manual', 'teacher']).default('manual'),
});

const courseCriterionSchema = z.object({
  criterion_type: z.enum(['required_modules', 'min_grade', 'required_date', 'all_modules']),
  settings: z.record(z.unknown()).default({}),
});

export async function completionRoutes(fastify: FastifyInstance) {
  // ── Activity Completion Rules ─────────────────────────────────────────────

  fastify.get('/modules/:moduleId/rules', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const { rows } = await pool.query(
      `SELECT r.* FROM activity_completion_rules r
       JOIN course_modules m ON m.module_id = r.module_id
       WHERE r.module_id = $1 AND r.tenant_id = $2`,
      [moduleId, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('No completion rule found for this module');
    return reply.send(rows[0]);
  });

  fastify.put('/modules/:moduleId/rules', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const body = completionRuleSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO activity_completion_rules
         (tenant_id, module_id, completion_type, passing_grade, require_view, expected_completion_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (module_id) DO UPDATE SET
         completion_type          = EXCLUDED.completion_type,
         passing_grade            = EXCLUDED.passing_grade,
         require_view             = EXCLUDED.require_view,
         expected_completion_date = EXCLUDED.expected_completion_date,
         updated_at               = now()
       RETURNING *`,
      [
        request.tenantId, moduleId,
        body.data.completion_type, body.data.passing_grade ?? null,
        body.data.require_view, body.data.expected_completion_date ?? null,
        request.user.sub,
      ]
    );
    return reply.status(200).send(rows[0]);
  });

  fastify.delete('/modules/:moduleId/rules', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    await pool.query(
      `DELETE FROM activity_completion_rules WHERE module_id = $1 AND tenant_id = $2`,
      [moduleId, request.tenantId]
    );
    return reply.status(204).send();
  });

  // ── Activity Completion States ────────────────────────────────────────────

  fastify.get('/modules/:moduleId/states', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const { rows } = await pool.query(
      `SELECT s.*, u.display_name, u.email FROM activity_completion_states s
       JOIN users u ON u.user_id = s.user_id
       WHERE s.module_id = $1 AND s.tenant_id = $2
       ORDER BY s.updated_at DESC`,
      [moduleId, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.get('/modules/:moduleId/states/me', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const { rows } = await pool.query(
      `SELECT * FROM activity_completion_states
       WHERE module_id = $1 AND user_id = $2 AND tenant_id = $3`,
      [moduleId, request.user.sub, request.tenantId]
    );
    if (rows.length === 0) {
      return reply.send({ module_id: moduleId, user_id: request.user.sub, state: 'incomplete' });
    }
    return reply.send(rows[0]);
  });

  fastify.post('/modules/:moduleId/complete', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const body = manualCompleteSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const targetUserId = body.data.user_id ?? request.user.sub;
    const isTeacherOverride = !!body.data.user_id && body.data.user_id !== request.user.sub;

    const { rows } = await pool.query(
      `INSERT INTO activity_completion_states
         (tenant_id, module_id, user_id, state, completion_source, completed_at, overridden_by)
       VALUES ($1, $2, $3, $4, $5, now(), $6)
       ON CONFLICT (module_id, user_id) DO UPDATE SET
         state            = EXCLUDED.state,
         completion_source = EXCLUDED.completion_source,
         completed_at     = CASE WHEN EXCLUDED.state != 'incomplete' THEN now() ELSE NULL END,
         overridden_by    = EXCLUDED.overridden_by,
         updated_at       = now()
       RETURNING *`,
      [
        request.tenantId, moduleId, targetUserId,
        body.data.state, body.data.completion_source,
        isTeacherOverride ? request.user.sub : null,
      ]
    );

    // Trigger async course completion evaluation (fire-and-forget)
    evaluateCourseCompletion(request.tenantId, moduleId, targetUserId).catch((err: unknown) => {
      request.log.error({ err, moduleId, userId: targetUserId }, 'Course completion evaluation failed');
    });

    return reply.status(201).send(rows[0]);
  });

  fastify.delete('/modules/:moduleId/complete', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const { user_id } = request.query as { user_id?: string };
    const targetUserId = user_id ?? request.user.sub;
    await pool.query(
      `UPDATE activity_completion_states
       SET state = 'incomplete', completed_at = NULL, overridden_by = $4, updated_at = now()
       WHERE module_id = $1 AND user_id = $2 AND tenant_id = $3`,
      [moduleId, targetUserId, request.tenantId, request.user.sub]
    );
    return reply.status(204).send();
  });

  // ── Course Completion Criteria ────────────────────────────────────────────

  fastify.get('/courses/:courseId/criteria', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { courseId } = request.params as { courseId: string };
    const { rows } = await pool.query(
      `SELECT * FROM course_completion_criteria WHERE course_id = $1 AND tenant_id = $2 ORDER BY created_at`,
      [courseId, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/courses/:courseId/criteria', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { courseId } = request.params as { courseId: string };
    const body = courseCriterionSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO course_completion_criteria (tenant_id, course_id, criterion_type, settings, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [request.tenantId, courseId, body.data.criterion_type, JSON.stringify(body.data.settings), request.user.sub]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.delete('/courses/:courseId/criteria/:criterionId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { courseId, criterionId } = request.params as { courseId: string; criterionId: string };
    await pool.query(
      `DELETE FROM course_completion_criteria WHERE criterion_id = $1 AND course_id = $2 AND tenant_id = $3`,
      [criterionId, courseId, request.tenantId]
    );
    return reply.status(204).send();
  });

  // ── Course Progress ───────────────────────────────────────────────────────

  fastify.get('/courses/:courseId/progress', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { courseId } = request.params as { courseId: string };
    const userId = request.user.sub;
    return reply.send(await buildProgressSummary(request.tenantId, courseId, userId));
  });

  fastify.get('/courses/:courseId/summary', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { courseId } = request.params as { courseId: string };
    const { rows } = await pool.query(
      `SELECT s.*, u.display_name, u.email
       FROM course_completion_states s
       JOIN users u ON u.user_id = s.user_id
       WHERE s.course_id = $1 AND s.tenant_id = $2
       ORDER BY s.progress_pct DESC`,
      [courseId, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/courses/:courseId/evaluate', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { courseId } = request.params as { courseId: string };
    // Evaluate all enrolled learners for this course
    const { rows: enrolments } = await pool.query(
      `SELECT user_id FROM enrolments WHERE course_id = $1 AND tenant_id = $2 AND status = 'active'`,
      [courseId, request.tenantId]
    );
    const results = await Promise.allSettled(
      enrolments.map((e: { user_id: string }) =>
        updateCourseCompletionState(request.tenantId, courseId, e.user_id)
      )
    );
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    return reply.send({ evaluated: enrolments.length, succeeded });
  });
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function buildProgressSummary(tenantId: string, courseId: string, userId: string) {
  const [{ rows: modules }, { rows: states }, { rows: courseState }] = await Promise.all([
    pool.query(
      `SELECT m.module_id FROM course_modules m
       JOIN course_sections s ON s.section_id = m.section_id
       JOIN activity_completion_rules r ON r.module_id = m.module_id
       WHERE s.course_id = $1 AND m.tenant_id = $2`,
      [courseId, tenantId]
    ),
    pool.query(
      `SELECT acs.* FROM activity_completion_states acs
       JOIN course_modules m ON m.module_id = acs.module_id
       JOIN course_sections s ON s.section_id = m.section_id
       WHERE s.course_id = $1 AND acs.user_id = $2 AND acs.tenant_id = $3`,
      [courseId, userId, tenantId]
    ),
    pool.query(
      `SELECT * FROM course_completion_states WHERE course_id = $1 AND user_id = $2 AND tenant_id = $3`,
      [courseId, userId, tenantId]
    ),
  ]);

  const stateMap = new Map(states.map((s: { module_id: string; state: string }) => [s.module_id, s.state]));
  const totalTracked = modules.length;
  let completeCount = 0;
  let completePassCount = 0;
  let completeFailCount = 0;

  for (const m of modules) {
    const s = stateMap.get(m.module_id) ?? 'incomplete';
    if (s === 'complete' || s === 'complete_pass' || s === 'complete_fail') completeCount++;
    if (s === 'complete_pass') completePassCount++;
    if (s === 'complete_fail') completeFailCount++;
  }

  const progressPct = totalTracked > 0 ? Math.round((completeCount / totalTracked) * 100) : 0;
  const cs = courseState[0];

  return {
    course_id: courseId,
    user_id: userId,
    state: cs?.state ?? 'incomplete',
    progress_pct: cs?.progress_pct ?? progressPct,
    total_tracked: totalTracked,
    complete_count: completeCount,
    incomplete_count: totalTracked - completeCount,
    complete_pass_count: completePassCount,
    complete_fail_count: completeFailCount,
    completed_at: cs?.completed_at ?? null,
    last_evaluated_at: cs?.last_evaluated_at ?? null,
  };
}

async function updateCourseCompletionState(tenantId: string, courseId: string, userId: string) {
  // Count tracked modules and completed states
  const { rows: modules } = await pool.query(
    `SELECT m.module_id FROM course_modules m
     JOIN course_sections s ON s.section_id = m.section_id
     JOIN activity_completion_rules r ON r.module_id = m.module_id
     WHERE s.course_id = $1 AND m.tenant_id = $2`,
    [courseId, tenantId]
  );

  if (modules.length === 0) return; // no tracked modules, nothing to do

  const moduleIds = modules.map((m: { module_id: string }) => m.module_id);
  const { rows: completedStates } = await pool.query(
    `SELECT module_id, state FROM activity_completion_states
     WHERE module_id = ANY($1) AND user_id = $2 AND tenant_id = $3
       AND state IN ('complete','complete_pass','complete_fail')`,
    [moduleIds, userId, tenantId]
  );

  const totalTracked = modules.length;
  const completeCount = completedStates.length;
  const progressPct = Math.round((completeCount / totalTracked) * 100);

  // Evaluate course completion criteria
  const { rows: criteria } = await pool.query(
    `SELECT * FROM course_completion_criteria WHERE course_id = $1 AND tenant_id = $2`,
    [courseId, tenantId]
  );

  let allSatisfied = criteria.length > 0; // if no criteria, treat as no requirement (stays in_progress)
  for (const c of criteria) {
    if (!await isCriterionSatisfied(c, moduleIds, completedStates, tenantId, userId)) {
      allSatisfied = false;
      break;
    }
  }

  let newState: 'incomplete' | 'in_progress' | 'complete' = 'incomplete';
  if (allSatisfied && criteria.length > 0) {
    newState = 'complete';
  } else if (completeCount > 0) {
    newState = 'in_progress';
  }

  const nowIso = new Date().toISOString();
  await pool.query(
    `INSERT INTO course_completion_states
       (tenant_id, course_id, user_id, state, progress_pct, completed_at, last_evaluated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (course_id, user_id) DO UPDATE SET
       state              = EXCLUDED.state,
       progress_pct       = EXCLUDED.progress_pct,
       completed_at       = CASE
                              WHEN EXCLUDED.state = 'complete'
                               AND course_completion_states.completed_at IS NULL
                              THEN EXCLUDED.completed_at
                              ELSE course_completion_states.completed_at
                            END,
       last_evaluated_at  = now(),
       updated_at         = now()`,
    [tenantId, courseId, userId, newState, progressPct, newState === 'complete' ? nowIso : null]
  );
}

interface CompletionCriterionRow {
  criterion_type: string;
  settings: Record<string, unknown>;
}

async function isCriterionSatisfied(
  criterion: CompletionCriterionRow,
  trackedModuleIds: string[],
  completedStates: Array<{ module_id: string; state: string }>,
  tenantId: string,
  userId: string
): Promise<boolean> {
  const completedSet = new Set(completedStates.map(s => s.module_id));

  switch (criterion.criterion_type) {
    case 'all_modules':
      return trackedModuleIds.every(id => completedSet.has(id));

    case 'required_modules': {
      const required = (criterion.settings.module_ids as string[]) ?? [];
      return required.every(id => completedSet.has(id));
    }

    case 'min_grade': {
      const gradeItemIds = (criterion.settings.grade_item_ids as string[]) ?? [];
      const minGrade = (criterion.settings.min_grade as number) ?? 0;
      if (gradeItemIds.length === 0) return true;
      const { rows } = await pool.query(
        `SELECT AVG(grade) as avg_grade FROM grades
         WHERE item_id = ANY($1) AND user_id = $2 AND tenant_id = $3 AND grade IS NOT NULL`,
        [gradeItemIds, userId, tenantId]
      );
      const rawAvg = rows[0]?.avg_grade;
      const avg = rawAvg != null ? parseFloat(String(rawAvg)) : 0;
      return avg >= minGrade;
    }

    case 'required_date': {
      const requiredDate = criterion.settings.required_date as string;
      if (!requiredDate) return true;
      return new Date() >= new Date(requiredDate);
    }

    default:
      return false;
  }
}

// Fire-and-forget helper that finds the course for a module and triggers evaluation
async function evaluateCourseCompletion(tenantId: string, moduleId: string, userId: string) {
  const { rows } = await pool.query(
    `SELECT s.course_id FROM course_sections s
     JOIN course_modules m ON m.section_id = s.section_id
     WHERE m.module_id = $1 AND m.tenant_id = $2`,
    [moduleId, tenantId]
  );
  if (rows.length > 0) {
    await updateCourseCompletionState(tenantId, rows[0].course_id, userId);
  }
}
