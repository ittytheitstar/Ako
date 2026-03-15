import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const frameworkCreateSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional().default('1.0'),
  source: z.enum(['manual', 'csv', 'case']).optional().default('manual'),
  description: z.string().optional(),
});

const frameworkUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  version: z.string().optional(),
  description: z.string().optional(),
});

const importCsvSchema = z.object({
  rows: z.array(z.object({
    short_name: z.string().min(1),
    description: z.string().optional(),
    idnumber: z.string().optional(),
    parent_idnumber: z.string().optional(),
  })),
});

const competencyCreateSchema = z.object({
  parent_id: z.string().uuid().optional(),
  short_name: z.string().min(1),
  description: z.string().optional(),
  idnumber: z.string().optional(),
});

const competencyUpdateSchema = z.object({
  short_name: z.string().min(1).optional(),
  description: z.string().optional(),
  idnumber: z.string().optional(),
});

const courseCompetencySchema = z.object({
  links: z.array(z.object({
    competency_id: z.string().uuid(),
    proficiency_expectation: z.enum(['introduced', 'developing', 'demonstrated', 'mastered'])
      .optional().default('developing'),
  })),
});

const moduleCompetencySchema = z.object({
  competency_ids: z.array(z.string().uuid()),
});

const evidenceCreateSchema = z.object({
  competency_id: z.string().uuid(),
  user_id: z.string().uuid(),
  course_id: z.string().uuid().optional(),
  source_type: z.enum(['assignment', 'quiz', 'teacher_judgment', 'portfolio']).default('teacher_judgment'),
  source_id: z.string().uuid().optional(),
  proficiency_rating: z.enum(['not_yet', 'beginning', 'developing', 'proficient', 'advanced']),
  rating_source: z.enum(['automatic', 'teacher']).default('teacher'),
  evidence_date: z.string().optional(),
  notes: z.string().optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function buildCompetencyTree(frameworkId: string, tenantId: string): Promise<unknown[]> {
  const { rows } = await pool.query(
    `SELECT * FROM competencies WHERE framework_id = $1 AND tenant_id = $2 ORDER BY level, short_name`,
    [frameworkId, tenantId]
  );
  const byId = new Map(rows.map(r => [r.competency_id, { ...r, children: [] as unknown[] }]));
  const roots: unknown[] = [];
  for (const node of byId.values()) {
    const n = node as { parent_id?: string };
    if (n.parent_id && byId.has(n.parent_id)) {
      (byId.get(n.parent_id) as { children: unknown[] }).children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

async function recalculateProfile(tenantId: string, userId: string, competencyId: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT proficiency_rating, created_at FROM competency_evidence
     WHERE tenant_id = $1 AND user_id = $2 AND competency_id = $3
     ORDER BY created_at DESC`,
    [tenantId, userId, competencyId]
  );
  if (rows.length === 0) return;

  const ratingOrder = ['not_yet', 'beginning', 'developing', 'proficient', 'advanced'];
  const latest = rows[0].proficiency_rating as string;

  await pool.query(
    `INSERT INTO competency_profiles
       (tenant_id, user_id, competency_id, proficiency_rating, aggregation_strategy, evidence_count, last_evidence_at)
     VALUES ($1, $2, $3, $4, 'latest', $5, $6)
     ON CONFLICT (user_id, competency_id) DO UPDATE SET
       proficiency_rating   = EXCLUDED.proficiency_rating,
       evidence_count       = EXCLUDED.evidence_count,
       last_evidence_at     = EXCLUDED.last_evidence_at,
       updated_at           = now()`,
    [tenantId, userId, competencyId, latest, rows.length, rows[0].created_at]
  );

  void ratingOrder; // imported for sort order; currently using 'latest' strategy
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function competencyFrameworkRoutes(fastify: FastifyInstance) {
  // ── List frameworks ────────────────────────────────────────────────────────

  fastify.get('/', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Competency Frameworks'],
      summary: 'List competency frameworks',
      security: [{ bearerAuth: [] }],
      response: {
        200: { type: 'object', properties: { data: { type: 'array' } } },
      },
    },
  }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT f.*, COUNT(c.competency_id)::int AS competency_count
       FROM competency_frameworks f
       LEFT JOIN competencies c ON c.framework_id = f.framework_id
       WHERE f.tenant_id = $1
       GROUP BY f.framework_id
       ORDER BY f.created_at DESC`,
      [request.tenantId]
    );
    return reply.send({ data: rows });
  });

  // ── Create framework ───────────────────────────────────────────────────────

  fastify.post('/', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Competency Frameworks'],
      summary: 'Create a competency framework',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          version: { type: 'string' },
          source: { type: 'string', enum: ['manual', 'csv', 'case'] },
          description: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const body = frameworkCreateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO competency_frameworks (tenant_id, name, version, source, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [request.tenantId, body.data.name, body.data.version, body.data.source,
       body.data.description ?? null, request.user.sub]
    );
    return reply.status(201).send(rows[0]);
  });

  // ── Get framework with tree ────────────────────────────────────────────────

  fastify.get('/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Competency Frameworks'],
      summary: 'Get a framework with its competency tree',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM competency_frameworks WHERE framework_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Framework not found');
    const tree = await buildCompetencyTree(id, request.tenantId);
    return reply.send({ ...rows[0], competencies: tree });
  });

  // ── Update framework ───────────────────────────────────────────────────────

  fastify.patch('/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Competency Frameworks'],
      summary: 'Update framework metadata',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = frameworkUpdateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `UPDATE competency_frameworks SET
         name        = COALESCE($3, name),
         version     = COALESCE($4, version),
         description = COALESCE($5, description),
         updated_at  = now()
       WHERE framework_id = $1 AND tenant_id = $2 RETURNING *`,
      [id, request.tenantId, body.data.name ?? null, body.data.version ?? null,
       body.data.description ?? null]
    );
    if (rows.length === 0) throw NotFound('Framework not found');
    return reply.send(rows[0]);
  });

  // ── Delete framework ───────────────────────────────────────────────────────

  fastify.delete('/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Competency Frameworks'],
      summary: 'Delete a framework (only if no linked evidence)',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows: evidenceRows } = await pool.query(
      `SELECT 1 FROM competency_evidence e
       JOIN competencies c ON c.competency_id = e.competency_id
       WHERE c.framework_id = $1 AND e.tenant_id = $2 LIMIT 1`,
      [id, request.tenantId]
    );
    if (evidenceRows.length > 0) {
      throw BadRequest('Cannot delete a framework that has linked evidence records');
    }
    await pool.query(
      `DELETE FROM competency_frameworks WHERE framework_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    return reply.status(204).send();
  });

  // ── Import competencies (CSV rows) ─────────────────────────────────────────

  fastify.post('/:id/import', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Competency Frameworks'],
      summary: 'Import competencies from CSV rows or CASE JSON',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows: fRows } = await pool.query(
      `SELECT * FROM competency_frameworks WHERE framework_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (fRows.length === 0) throw NotFound('Framework not found');

    const body = importCsvSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    // Two-pass: first create roots, then link children by idnumber
    const idnumberToId = new Map<string, string>();
    const toCreate = body.data.rows;

    // Wrap import in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Pass 1 – create nodes without parents
      for (const row of toCreate.filter(r => !r.parent_idnumber)) {
        const { rows: cr } = await client.query(
          `INSERT INTO competencies (framework_id, tenant_id, short_name, description, idnumber, level)
           VALUES ($1, $2, $3, $4, $5, 0) RETURNING competency_id, idnumber`,
          [id, request.tenantId, row.short_name, row.description ?? null, row.idnumber ?? null]
        );
        if (row.idnumber) idnumberToId.set(row.idnumber, cr[0].competency_id);
      }

      // Pass 2 – create children
      for (const row of toCreate.filter(r => !!r.parent_idnumber)) {
        const parentId = row.parent_idnumber ? idnumberToId.get(row.parent_idnumber) : undefined;
        const { rows: cr } = await client.query(
          `INSERT INTO competencies (framework_id, tenant_id, parent_id, short_name, description, idnumber, level)
           VALUES ($1, $2, $3, $4, $5, $6,
             (SELECT COALESCE((SELECT level FROM competencies WHERE competency_id = $3), -1) + 1))
           RETURNING competency_id, idnumber`,
          [id, request.tenantId, parentId ?? null, row.short_name, row.description ?? null,
           row.idnumber ?? null]
        );
        if (row.idnumber) idnumberToId.set(row.idnumber, cr[0].competency_id);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const tree = await buildCompetencyTree(id, request.tenantId);
    return reply.status(201).send({ imported: toCreate.length, competencies: tree });
  });

  // ── Export as CSV ──────────────────────────────────────────────────────────

  fastify.get('/:id/export', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Competency Frameworks'],
      summary: 'Export framework competencies as CSV',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT c.idnumber, c.short_name, c.description, p.idnumber AS parent_idnumber
       FROM competencies c
       LEFT JOIN competencies p ON p.competency_id = c.parent_id
       WHERE c.framework_id = $1 AND c.tenant_id = $2
       ORDER BY c.level, c.short_name`,
      [id, request.tenantId]
    );
    const csv = ['idnumber,short_name,description,parent_idnumber',
      ...rows.map((r: Record<string, string | null>) =>
        [r.idnumber ?? '', r.short_name, r.description ?? '', r.parent_idnumber ?? '']
          .map(v => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      )].join('\n');
    return reply.header('Content-Type', 'text/csv').send(csv);
  });
}

// ─── Competency CRUD (nested under frameworks) ────────────────────────────────

export async function competencyRoutes(fastify: FastifyInstance) {
  // ── List competencies (flat or tree) ──────────────────────────────────────

  fastify.get('/:frameworkId/competencies', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Competencies'],
      summary: 'List competencies for a framework (flat or tree)',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { frameworkId } = request.params as { frameworkId: string };
    const { tree } = request.query as { tree?: string };
    if (tree === '1' || tree === 'true') {
      const result = await buildCompetencyTree(frameworkId, request.tenantId);
      return reply.send({ data: result });
    }
    const { rows } = await pool.query(
      `SELECT * FROM competencies WHERE framework_id = $1 AND tenant_id = $2 ORDER BY level, short_name`,
      [frameworkId, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  // ── Create competency ──────────────────────────────────────────────────────

  fastify.post('/:frameworkId/competencies', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Competencies'],
      summary: 'Create a competency within a framework',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { frameworkId } = request.params as { frameworkId: string };
    const body = competencyCreateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    let level = 0;
    if (body.data.parent_id) {
      const { rows: pRows } = await pool.query(
        `SELECT level FROM competencies WHERE competency_id = $1 AND tenant_id = $2`,
        [body.data.parent_id, request.tenantId]
      );
      if (pRows.length === 0) throw NotFound('Parent competency not found');
      level = (pRows[0].level as number) + 1;
    }

    const { rows } = await pool.query(
      `INSERT INTO competencies (framework_id, tenant_id, parent_id, short_name, description, idnumber, level)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [frameworkId, request.tenantId, body.data.parent_id ?? null,
       body.data.short_name, body.data.description ?? null, body.data.idnumber ?? null, level]
    );
    return reply.status(201).send(rows[0]);
  });
}

export async function competencyCrudRoutes(fastify: FastifyInstance) {
  // ── Update competency ──────────────────────────────────────────────────────

  fastify.patch('/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Competencies'],
      summary: 'Update a competency',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = competencyUpdateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `UPDATE competencies SET
         short_name  = COALESCE($3, short_name),
         description = COALESCE($4, description),
         idnumber    = COALESCE($5, idnumber),
         updated_at  = now()
       WHERE competency_id = $1 AND tenant_id = $2 RETURNING *`,
      [id, request.tenantId, body.data.short_name ?? null, body.data.description ?? null,
       body.data.idnumber ?? null]
    );
    if (rows.length === 0) throw NotFound('Competency not found');
    return reply.send(rows[0]);
  });

  // ── Delete competency (leaf only) ─────────────────────────────────────────

  fastify.delete('/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Competencies'],
      summary: 'Delete a leaf competency (no children)',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows: childRows } = await pool.query(
      `SELECT 1 FROM competencies WHERE parent_id = $1 AND tenant_id = $2 LIMIT 1`,
      [id, request.tenantId]
    );
    if (childRows.length > 0) throw BadRequest('Cannot delete a competency that has children');
    await pool.query(
      `DELETE FROM competencies WHERE competency_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    return reply.status(204).send();
  });
}

// ─── Course & Activity Mapping ────────────────────────────────────────────────

export async function competencyMappingRoutes(fastify: FastifyInstance) {
  // ── Get course competency links ────────────────────────────────────────────

  fastify.get('/courses/:id/competencies', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Competency Mapping'],
      summary: 'List competencies mapped to a course',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT l.*, c.short_name AS competency_short_name, c.description AS competency_description
       FROM course_competency_links l
       JOIN competencies c ON c.competency_id = l.competency_id
       WHERE l.course_id = $1 AND l.tenant_id = $2`,
      [id, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  // ── Replace course competency links ───────────────────────────────────────

  fastify.put('/courses/:id/competencies', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Competency Mapping'],
      summary: 'Replace (set) competency mapping for a course',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = courseCompetencySchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    await pool.query(`DELETE FROM course_competency_links WHERE course_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]);

    const inserted = [];
    for (const link of body.data.links) {
      const { rows } = await pool.query(
        `INSERT INTO course_competency_links (tenant_id, course_id, competency_id, proficiency_expectation)
         VALUES ($1, $2, $3, $4) ON CONFLICT (course_id, competency_id) DO UPDATE
           SET proficiency_expectation = EXCLUDED.proficiency_expectation
         RETURNING *`,
        [request.tenantId, id, link.competency_id, link.proficiency_expectation]
      );
      inserted.push(rows[0]);
    }
    return reply.send({ data: inserted });
  });

  // ── Get module competency links ────────────────────────────────────────────

  fastify.get('/modules/:id/competencies', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Competency Mapping'],
      summary: 'List competencies tagged to a module',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT l.*, c.short_name AS competency_short_name
       FROM activity_competency_links l
       JOIN competencies c ON c.competency_id = l.competency_id
       WHERE l.module_id = $1 AND l.tenant_id = $2`,
      [id, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  // ── Replace module competency links ───────────────────────────────────────

  fastify.put('/modules/:id/competencies', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Competency Mapping'],
      summary: 'Replace (set) competency tags for a module',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = moduleCompetencySchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    await pool.query(`DELETE FROM activity_competency_links WHERE module_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]);

    const inserted = [];
    for (const compId of body.data.competency_ids) {
      const { rows } = await pool.query(
        `INSERT INTO activity_competency_links (tenant_id, module_id, competency_id)
         VALUES ($1, $2, $3) ON CONFLICT (module_id, competency_id) DO NOTHING RETURNING *`,
        [request.tenantId, id, compId]
      );
      if (rows.length > 0) inserted.push(rows[0]);
    }
    return reply.send({ data: inserted });
  });
}

// ─── Evidence & Profiles ──────────────────────────────────────────────────────

export async function competencyEvidenceRoutes(fastify: FastifyInstance) {
  // ── List evidence ──────────────────────────────────────────────────────────

  fastify.get('/', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Competency Evidence'],
      summary: 'List evidence records (filter by user, competency, course)',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { user_id, competency_id, course_id } = request.query as Record<string, string>;
    const conditions: string[] = ['e.tenant_id = $1'];
    const params: unknown[] = [request.tenantId];
    let idx = 2;
    if (user_id) { conditions.push(`e.user_id = $${idx++}`); params.push(user_id); }
    if (competency_id) { conditions.push(`e.competency_id = $${idx++}`); params.push(competency_id); }
    if (course_id) { conditions.push(`e.course_id = $${idx++}`); params.push(course_id); }

    const { rows } = await pool.query(
      `SELECT e.*, c.short_name AS competency_short_name, u.display_name AS user_name
       FROM competency_evidence e
       JOIN competencies c ON c.competency_id = e.competency_id
       JOIN users u ON u.user_id = e.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.created_at DESC`,
      params
    );
    return reply.send({ data: rows });
  });

  // ── Record teacher judgment ────────────────────────────────────────────────

  fastify.post('/', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Competency Evidence'],
      summary: 'Record evidence (teacher judgment or portfolio)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['competency_id', 'user_id', 'proficiency_rating'],
        properties: {
          competency_id: { type: 'string', format: 'uuid' },
          user_id: { type: 'string', format: 'uuid' },
          course_id: { type: 'string', format: 'uuid' },
          source_type: { type: 'string', enum: ['assignment', 'quiz', 'teacher_judgment', 'portfolio'] },
          proficiency_rating: { type: 'string', enum: ['not_yet', 'beginning', 'developing', 'proficient', 'advanced'] },
          rating_source: { type: 'string', enum: ['automatic', 'teacher'] },
          evidence_date: { type: 'string' },
          notes: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const body = evidenceCreateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const { rows } = await pool.query(
      `INSERT INTO competency_evidence
         (tenant_id, competency_id, user_id, course_id, source_type, source_id,
          proficiency_rating, rating_source, evidence_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        request.tenantId, body.data.competency_id, body.data.user_id,
        body.data.course_id ?? null, body.data.source_type,
        body.data.source_id ?? null, body.data.proficiency_rating,
        body.data.rating_source, body.data.evidence_date ?? new Date().toISOString().split('T')[0],
        body.data.notes ?? null, request.user.sub,
      ]
    );

    // Async profile recalculation
    await recalculateProfile(request.tenantId, body.data.user_id, body.data.competency_id);

    return reply.status(201).send(rows[0]);
  });
}

// ─── User Profile & Transcript ────────────────────────────────────────────────

export async function competencyProfileRoutes(fastify: FastifyInstance) {
  // ── Aggregated profile ─────────────────────────────────────────────────────

  fastify.get('/:userId/competency-profile', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Competency Evidence'],
      summary: 'Get aggregated competency profile for a learner',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { rows } = await pool.query(
      `SELECT p.*, c.short_name AS competency_short_name, c.framework_id
       FROM competency_profiles p
       JOIN competencies c ON c.competency_id = p.competency_id
       WHERE p.user_id = $1 AND p.tenant_id = $2
       ORDER BY c.framework_id, c.level, c.short_name`,
      [userId, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  // ── Full evidence transcript ───────────────────────────────────────────────

  fastify.get('/:userId/competency-transcript', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Competency Evidence'],
      summary: 'Get full evidence transcript for a learner',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { format } = request.query as { format?: string };
    const { rows } = await pool.query(
      `SELECT e.*, c.short_name AS competency_short_name, f.name AS framework_name
       FROM competency_evidence e
       JOIN competencies c ON c.competency_id = e.competency_id
       JOIN competency_frameworks f ON f.framework_id = c.framework_id
       WHERE e.user_id = $1 AND e.tenant_id = $2
       ORDER BY e.evidence_date DESC, e.created_at DESC`,
      [userId, request.tenantId]
    );

    if (format === 'csv') {
      const csv = [
        'evidence_date,framework,competency,proficiency_rating,source_type,rating_source,notes',
        ...rows.map((r: Record<string, string | null>) =>
          [r.evidence_date, r.framework_name, r.competency_short_name,
           r.proficiency_rating, r.source_type, r.rating_source, r.notes ?? '']
            .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
            .join(',')
        ),
      ].join('\n');
      return reply.header('Content-Type', 'text/csv').send(csv);
    }

    return reply.send({ data: rows });
  });
}
