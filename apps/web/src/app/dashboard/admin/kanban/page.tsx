'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { KanbanBoard, KanbanBoardTemplate } from '@ako/shared';

const STATUS_BADGE: Record<string, string> = {
  active:   'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-600',
};

// ─── Template Manager Panel ───────────────────────────────────────────────────

function TemplateManager() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', lane_titles: 'Backlog, In Progress, Review, Done' });
  const [instantiating, setInstantiating] = useState<string | null>(null);
  const [instantiateForm, setInstantiateForm] = useState({ course_id: '', user_ids_raw: '' });

  const { data } = useQuery({
    queryKey: ['board-templates'],
    queryFn: () => apiClient.getBoardTemplates(),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const parts = form.lane_titles.split(',');
      const lastIdx = parts.length - 1;
      const lane_definitions = parts
        .map((t, i) => ({ title: t.trim(), color: '#6366f1', wip_limit: 0, is_done_lane: i === lastIdx }));
      return apiClient.createBoardTemplate({ name: form.name, description: form.description, lane_definitions });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['board-templates'] }); setShowCreate(false); setForm({ name: '', description: '', lane_titles: 'Backlog, In Progress, Review, Done' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteBoardTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['board-templates'] }),
  });

  const instantiateMutation = useMutation({
    mutationFn: (templateId: string) => {
      const user_ids = instantiateForm.user_ids_raw.split(',').map(u => u.trim()).filter(Boolean);
      return apiClient.instantiateBoardTemplate(templateId, { course_id: instantiateForm.course_id, user_ids });
    },
    onSuccess: (result) => {
      alert(`Created ${result.created} boards from template.`);
      setInstantiating(null);
      setInstantiateForm({ course_id: '', user_ids_raw: '' });
      qc.invalidateQueries({ queryKey: ['kanban-boards'] });
    },
  });

  const templates = (data?.data ?? []) as KanbanBoardTemplate[];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Board Templates</h2>
        <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">
          + New Template
        </button>
      </div>

      {showCreate && (
        <div className="bg-gray-50 border rounded-lg p-4 mb-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Template Name *</label>
            <input className="w-full border rounded px-3 py-2 text-sm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <input className="w-full border rounded px-3 py-2 text-sm" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Lane Titles (comma-separated, last = Done lane)</label>
            <input className="w-full border rounded px-3 py-2 text-sm" value={form.lane_titles} onChange={e => setForm(f => ({ ...f, lane_titles: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm border rounded text-gray-600">Cancel</button>
            <button disabled={!form.name || createMutation.isPending} onClick={() => createMutation.mutate()} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded disabled:opacity-50">
              Create
            </button>
          </div>
        </div>
      )}

      {templates.length === 0 ? (
        <p className="text-gray-400 text-sm py-6 text-center">No templates yet.</p>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.template_id} className="bg-white border rounded-lg p-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-sm text-gray-900">{t.name}</p>
                {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  {Array.isArray(t.lane_definitions) ? t.lane_definitions.length : 0} lanes
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setInstantiating(t.template_id)}
                  className="text-xs px-3 py-1.5 rounded border border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                >
                  Instantiate
                </button>
                <button
                  onClick={() => deleteMutation.mutate(t.template_id)}
                  className="text-xs px-3 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {instantiating && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-bold mb-4">Instantiate Template for Students</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Course ID *</label>
                <input className="w-full border rounded px-3 py-2 text-sm font-mono" value={instantiateForm.course_id} onChange={e => setInstantiateForm(f => ({ ...f, course_id: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Student User IDs (comma-separated)</label>
                <textarea className="w-full border rounded px-3 py-2 text-sm font-mono" rows={3} value={instantiateForm.user_ids_raw} onChange={e => setInstantiateForm(f => ({ ...f, user_ids_raw: e.target.value }))} placeholder="uuid1, uuid2, uuid3" />
              </div>
            </div>
            {instantiateMutation.error && <p className="text-red-600 text-sm mt-2">{String(instantiateMutation.error)}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setInstantiating(null)} className="px-3 py-1.5 text-sm border rounded text-gray-600">Cancel</button>
              <button
                disabled={!instantiateForm.course_id || instantiateMutation.isPending}
                onClick={() => instantiateMutation.mutate(instantiating)}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded disabled:opacity-50"
              >
                {instantiateMutation.isPending ? 'Creating…' : 'Create Boards'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function AdminKanbanPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'boards' | 'templates'>('boards');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active');

  const { data, isLoading } = useQuery({
    queryKey: ['kanban-boards', statusFilter, 'admin'],
    queryFn: () => apiClient.getKanbanBoards({ status: statusFilter }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiClient.archiveKanbanBoard(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kanban-boards'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteKanbanBoard(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kanban-boards'] }),
  });

  const boards = (data?.data ?? []) as KanbanBoard[];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Kanban Administration</h1>
        <p className="text-sm text-gray-500 mt-1">Manage all boards, templates and access across the tenant</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {(['boards', 'templates'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'templates' && <TemplateManager />}

      {tab === 'boards' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex rounded-lg border overflow-hidden">
              {(['active', 'archived'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-sm font-medium ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-gray-400">Loading…</div>
          ) : boards.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No {statusFilter} boards found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="pb-2 pr-4 font-medium">Title</th>
                    <th className="pb-2 pr-4 font-medium">Owner</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Lanes</th>
                    <th className="pb-2 pr-4 font-medium">Cards</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {boards.map(board => (
                    <tr key={board.board_id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4">
                        <a href={`/dashboard/kanban/${board.board_id}`} className="font-medium text-gray-900 hover:text-indigo-600">
                          {board.title}
                        </a>
                      </td>
                      <td className="py-2 pr-4 text-gray-500">{board.owner_display_name ?? '—'}</td>
                      <td className="py-2 pr-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[board.status]}`}>
                          {board.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-500">{board.lane_count ?? 0}</td>
                      <td className="py-2 pr-4 text-gray-500">{board.card_count ?? 0}</td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          {board.status === 'active' && (
                            <button
                              onClick={() => archiveMutation.mutate(board.board_id)}
                              className="text-xs text-gray-500 hover:text-amber-700 hover:underline"
                            >
                              Archive
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(`Delete board "${board.title}"?`)) deleteMutation.mutate(board.board_id);
                            }}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
