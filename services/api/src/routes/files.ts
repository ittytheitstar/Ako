import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/client';
import { BadRequest, NotFound } from '@ako/shared';

export async function fileRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    // files table: file_id, tenant_id, owner_id, storage_provider, storage_key, mime_type, size_bytes, sha256, created_at
    const { rows } = await pool.query(
      `SELECT file_id, tenant_id, owner_id, storage_provider, storage_key, mime_type, size_bytes, created_at
       FROM files WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [request.tenantId]
    );
    return reply.send({ data: rows });
  });

  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT * FROM files WHERE file_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rows.length === 0) throw NotFound('File not found');
    return reply.send(rows[0]);
  });

  // File upload stub — registers file metadata (real implementation uses object storage)
  fastify.post('/upload', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = z.object({
      storage_key: z.string().min(1),
      mime_type: z.string().optional(),
      size_bytes: z.number().int().nonnegative().optional(),
      sha256: z.string().optional(),
    }).safeParse(request.body);
    if (!body.success) throw BadRequest(body.error.message);
    const { rows } = await pool.query(
      `INSERT INTO files (tenant_id, owner_id, storage_key, mime_type, size_bytes, sha256)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING file_id, tenant_id, owner_id, storage_provider, storage_key, mime_type, size_bytes, created_at`,
      [request.tenantId, request.user.sub, body.data.storage_key, body.data.mime_type, body.data.size_bytes, body.data.sha256]
    );
    return reply.status(201).send(rows[0]);
  });

  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rowCount } = await pool.query(
      `DELETE FROM files WHERE file_id = $1 AND tenant_id = $2`,
      [id, request.tenantId]
    );
    if (rowCount === 0) throw NotFound('File not found');
    return reply.status(204).send();
  });
}
