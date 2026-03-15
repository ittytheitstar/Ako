import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

const wikiConfigSchema = z.object({
  wiki_type: z.enum(['individual', 'collaborative']).default('collaborative'),
});

const pageCreateSchema = z.object({
  title: z.string().min(1),
  body: z.record(z.unknown()).default({}),
});

const pageUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.record(z.unknown()).optional(),
});

const lockSchema = z.object({
  locked: z.boolean(),
});

export async function wikiRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  async function getOrCreateWiki(moduleId: string, tenantId: string) {
    const { rows } = await pool.query(
      `SELECT * FROM wikis WHERE module_id = $1 AND tenant_id = $2`,
      [moduleId, tenantId]
    );
    if (rows.length === 0) throw NotFound('Wiki not found');
    return rows[0];
  }

  // ── Wiki config ───────────────────────────────────────────────────────────

  fastify.put('/:moduleId', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const body = wikiConfigSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO wikis (module_id, tenant_id, wiki_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (module_id) DO UPDATE SET
         wiki_type  = EXCLUDED.wiki_type,
         updated_at = now()
       RETURNING *`,
      [moduleId, request.tenantId, body.data.wiki_type]
    );
    return reply.status(200).send(rows[0]);
  });

  // ── Pages ─────────────────────────────────────────────────────────────────

  fastify.get('/:moduleId/pages', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const wiki = await getOrCreateWiki(moduleId, request.tenantId);
    const { rows } = await pool.query(
      `SELECT p.*, u.display_name AS owner_name
       FROM wiki_pages p
       LEFT JOIN users u ON u.user_id = p.owner_id
       WHERE p.wiki_id = $1 AND p.tenant_id = $2
       ORDER BY p.created_at`,
      [wiki.wiki_id, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/:moduleId/pages', async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const body = pageCreateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const wiki = await getOrCreateWiki(moduleId, request.tenantId);

    const ownerId = wiki.wiki_type === 'individual' ? request.user.sub : null;
    const { rows } = await pool.query(
      `INSERT INTO wiki_pages (wiki_id, tenant_id, owner_id, title, body)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [wiki.wiki_id, request.tenantId, ownerId, body.data.title, JSON.stringify(body.data.body)]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.get('/:moduleId/pages/:pageId', async (request, reply) => {
    const { moduleId, pageId } = request.params as { moduleId: string; pageId: string };
    const wiki = await getOrCreateWiki(moduleId, request.tenantId);
    const { rows } = await pool.query(
      `SELECT p.*, u.display_name AS owner_name
       FROM wiki_pages p
       LEFT JOIN users u ON u.user_id = p.owner_id
       WHERE p.page_id = $1 AND p.wiki_id = $2 AND p.tenant_id = $3`,
      [pageId, wiki.wiki_id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Page not found');
    return reply.send(rows[0]);
  });

  fastify.patch('/:moduleId/pages/:pageId', async (request, reply) => {
    const { moduleId, pageId } = request.params as { moduleId: string; pageId: string };
    const body = pageUpdateSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const wiki = await getOrCreateWiki(moduleId, request.tenantId);

    const { rows: pages } = await pool.query(
      `SELECT * FROM wiki_pages WHERE page_id = $1 AND wiki_id = $2 AND tenant_id = $3`,
      [pageId, wiki.wiki_id, request.tenantId]
    );
    if (pages.length === 0) throw NotFound('Page not found');
    const page = pages[0];

    if (page.locked) throw BadRequest('Page is locked and cannot be edited');

    // Snapshot current version before updating
    await pool.query(
      `INSERT INTO wiki_page_versions (page_id, tenant_id, version, body, edited_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [pageId, request.tenantId, page.version, page.body, request.user.sub]
    );

    const d = body.data;
    const sets: string[] = ['version = version + 1', 'updated_at = now()'];
    const params: unknown[] = [pageId, wiki.wiki_id, request.tenantId];
    if (d.title !== undefined) { params.push(d.title); sets.push(`title = $${params.length}`); }
    if (d.body !== undefined) { params.push(JSON.stringify(d.body)); sets.push(`body = $${params.length}`); }

    const { rows } = await pool.query(
      `UPDATE wiki_pages SET ${sets.join(', ')}
       WHERE page_id = $1 AND wiki_id = $2 AND tenant_id = $3
       RETURNING *`,
      params
    );
    return reply.send(rows[0]);
  });

  // ── Version history ───────────────────────────────────────────────────────

  fastify.get('/:moduleId/pages/:pageId/history', async (request, reply) => {
    const { moduleId, pageId } = request.params as { moduleId: string; pageId: string };
    const wiki = await getOrCreateWiki(moduleId, request.tenantId);

    const { rows: pages } = await pool.query(
      `SELECT page_id FROM wiki_pages WHERE page_id = $1 AND wiki_id = $2 AND tenant_id = $3`,
      [pageId, wiki.wiki_id, request.tenantId]
    );
    if (pages.length === 0) throw NotFound('Page not found');

    const { rows } = await pool.query(
      `SELECT v.*, u.display_name AS editor_name
       FROM wiki_page_versions v
       LEFT JOIN users u ON u.user_id = v.edited_by
       WHERE v.page_id = $1 AND v.tenant_id = $2
       ORDER BY v.version DESC`,
      [pageId, request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/:moduleId/pages/:pageId/revert/:versionId', async (request, reply) => {
    const { moduleId, pageId, versionId } = request.params as {
      moduleId: string; pageId: string; versionId: string;
    };
    const wiki = await getOrCreateWiki(moduleId, request.tenantId);

    const { rows: pages } = await pool.query(
      `SELECT * FROM wiki_pages WHERE page_id = $1 AND wiki_id = $2 AND tenant_id = $3`,
      [pageId, wiki.wiki_id, request.tenantId]
    );
    if (pages.length === 0) throw NotFound('Page not found');
    const page = pages[0];
    if (page.locked) throw BadRequest('Page is locked and cannot be reverted');

    const { rows: versions } = await pool.query(
      `SELECT * FROM wiki_page_versions WHERE version_id = $1 AND page_id = $2 AND tenant_id = $3`,
      [versionId, pageId, request.tenantId]
    );
    if (versions.length === 0) throw NotFound('Version not found');
    const version = versions[0];

    // Snapshot current before reverting
    await pool.query(
      `INSERT INTO wiki_page_versions (page_id, tenant_id, version, body, edited_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [pageId, request.tenantId, page.version, page.body, request.user.sub]
    );

    const { rows } = await pool.query(
      `UPDATE wiki_pages SET body = $1, version = version + 1, updated_at = now()
       WHERE page_id = $2 RETURNING *`,
      [version.body, pageId]
    );
    return reply.send(rows[0]);
  });

  // ── Lock ─────────────────────────────────────────────────────────────────

  fastify.post('/:moduleId/pages/:pageId/lock', async (request, reply) => {
    const { moduleId, pageId } = request.params as { moduleId: string; pageId: string };
    const body = lockSchema.safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const wiki = await getOrCreateWiki(moduleId, request.tenantId);

    const { rows } = await pool.query(
      `UPDATE wiki_pages SET locked = $1, updated_at = now()
       WHERE page_id = $2 AND wiki_id = $3 AND tenant_id = $4
       RETURNING *`,
      [body.data.locked, pageId, wiki.wiki_id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('Page not found');
    return reply.send(rows[0]);
  });
}
