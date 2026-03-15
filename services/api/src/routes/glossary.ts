import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const entryCreateSchema = z.object({
  term: z.string().min(1),
  definition: z.string().min(1),
  category_id: z.string().uuid().optional(),
});

const entryUpdateSchema = z.object({
  term: z.string().min(1).optional(),
  definition: z.string().min(1).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  category_id: z.string().uuid().nullable().optional(),
});

const categoryCreateSchema = z.object({
  name: z.string().min(1),
});

const importSchema = z.object({
  csv: z.string().min(1),
});

export async function glossaryRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // ── Categories ────────────────────────────────────────────────────────────

  fastify.get('/:moduleId/categories', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const { rows } = await pool.query(
      `SELECT * FROM glossary_categories WHERE module_id = $1 AND tenant_id = $2 ORDER BY name`,
      [moduleId, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/:moduleId/categories', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const body = categoryCreateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO glossary_categories (module_id, tenant_id, name)
       VALUES ($1, $2, $3) RETURNING *`,
      [moduleId, request.tenantId, body.data.name]
    );
    return reply.status(201).send(rows[0]);
  });

  // ── Entries ───────────────────────────────────────────────────────────────

  fastify.get('/:moduleId/entries', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const q = request.query as { status?: string; letter?: string; category_id?: string };
    const params: unknown[] = [moduleId, request.tenantId];
    const conditions: string[] = ['e.module_id = $1', 'e.tenant_id = $2'];

    if (q.status) { params.push(q.status); conditions.push(`e.status = $${params.length}`); }
    if (q.letter) { params.push(`${q.letter.toUpperCase()}%`); conditions.push(`upper(e.term) LIKE $${params.length}`); }
    if (q.category_id) { params.push(q.category_id); conditions.push(`e.category_id = $${params.length}`); }

    const { rows } = await pool.query(
      `SELECT e.*, u.display_name AS author_name, c.name AS category_name
       FROM glossary_entries e
       LEFT JOIN users u ON u.user_id = e.author_id
       LEFT JOIN glossary_categories c ON c.category_id = e.category_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.term`,
      params
    );
    return reply.send({ data: rows });
  });

  fastify.post('/:moduleId/entries', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const body = entryCreateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const d = body.data;
    const { rows } = await pool.query(
      `INSERT INTO glossary_entries (module_id, tenant_id, term, definition, author_id, category_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [moduleId, request.tenantId, d.term, d.definition, request.user.sub, d.category_id ?? null]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.patch('/:moduleId/entries/:id', async (request, reply) => {
    const { moduleId, id } = request.params as { moduleId: string; id: string };
    const body = entryUpdateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const d = body.data;

    const sets: string[] = [];
    const params: unknown[] = [id, moduleId, request.tenantId];
    if (d.term !== undefined) { params.push(d.term); sets.push(`term = $${params.length}`); }
    if (d.definition !== undefined) { params.push(d.definition); sets.push(`definition = $${params.length}`); }
    if (d.status !== undefined) { params.push(d.status); sets.push(`status = $${params.length}`); }
    if (d.category_id !== undefined) { params.push(d.category_id); sets.push(`category_id = $${params.length}`); }
    if (sets.length === 0) throw BadRequest('No fields to update');
    sets.push('updated_at = now()');

    const { rows } = await pool.query(
      `UPDATE glossary_entries SET ${sets.join(', ')}
       WHERE entry_id = $1 AND module_id = $2 AND tenant_id = $3
       RETURNING *`,
      params
    );
    if (rows.length === 0) throw NotFound('Entry not found');
    return reply.send(rows[0]);
  });

  fastify.delete('/:moduleId/entries/:id', async (request, reply) => {
    const { moduleId, id } = request.params as { moduleId: string; id: string };
    const { rowCount } = await pool.query(
      `DELETE FROM glossary_entries WHERE entry_id = $1 AND module_id = $2 AND tenant_id = $3`,
      [id, moduleId, request.tenantId]
    );
    if (!rowCount) throw NotFound('Entry not found');
    return reply.status(204).send();
  });

  // ── CSV Import ────────────────────────────────────────────────────────────

  fastify.post('/:moduleId/import', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const body = importSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);

    const lines = body.data.csv.split('\n').map((l) => l.trim()).filter(Boolean);
    // Skip header row if present (case-insensitive check for 'term' as first column)
    const firstLineLower = lines[0]?.toLowerCase() ?? '';
    const dataLines = firstLineLower.startsWith('term,') || firstLineLower === 'term'
      ? lines.slice(1)
      : lines;

    const imported: unknown[] = [];
    for (const line of dataLines) {
      // Simple RFC-4180 aware parser: handle quoted fields with embedded commas
      const fields: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
          fields.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
      fields.push(cur);

      const term = fields[0]?.trim();
      // Definition is a single column; take field[1] (quoted fields already parsed correctly)
      const definition = fields[1]?.trim();
      if (!term || !definition) continue;
      const { rows } = await pool.query(
        `INSERT INTO glossary_entries (module_id, tenant_id, term, definition, author_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [moduleId, request.tenantId, term, definition, request.user.sub]
      );
      imported.push(rows[0]);
    }

    return reply.status(201).send({ imported: imported.length, data: imported });
  });
}
