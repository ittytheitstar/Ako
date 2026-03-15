'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { KanbanBoard } from '@ako/shared';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  archived: 'bg-gray-200 text-gray-600',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-sky-100 text-sky-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

function BoardCard({ board, onArchive }: { board: KanbanBoard; onArchive: (id: string) => void }) {
  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <a href={`/dashboard/kanban/${board.board_id}`} className="font-semibold text-gray-900 hover:text-indigo-600 truncate block">
            {board.title}
          </a>
          {board.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{board.description}</p>
          )}
        </div>
        <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[board.status]}`}>
          {board.status}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
        {board.owner_display_name && (
          <span className="flex items-center gap-1">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
              {board.owner_display_name[0]?.toUpperCase()}
            </span>
            {board.owner_display_name}
          </span>
        )}
        <span>{board.lane_count ?? 0} lanes</span>
        <span>{board.card_count ?? 0} cards</span>
      </div>
      <div className="mt-3 flex gap-2">
        <a
          href={`/dashboard/kanban/${board.board_id}`}
          className="flex-1 text-center text-xs py-1.5 rounded border border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-medium"
        >
          Open Board
        </a>
        {board.status === 'active' && (
          <button
            onClick={() => onArchive(board.board_id)}
            className="text-xs py-1.5 px-3 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            Archive
          </button>
        )}
      </div>
    </div>
  );
}

function CreateBoardModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: '', description: '', course_id: '' });
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => apiClient.createKanbanBoard(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kanban-boards'] }); onCreated(); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">Create Board</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="My Project Board"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course ID *</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm font-mono"
              value={form.course_id}
              onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))}
              placeholder="uuid"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full border rounded px-3 py-2 text-sm"
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
        </div>
        {createMutation.error && (
          <p className="text-red-600 text-sm mt-2">{String(createMutation.error)}</p>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded border text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            disabled={!form.title || !form.course_id || createMutation.isPending}
            onClick={() => createMutation.mutate(form)}
            className="px-4 py-2 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating…' : 'Create Board'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KanbanBoardsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active');

  const { data, isLoading } = useQuery({
    queryKey: ['kanban-boards', statusFilter],
    queryFn: () => apiClient.getKanbanBoards({ status: statusFilter }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiClient.archiveKanbanBoard(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kanban-boards'] }),
  });

  const boards = (data?.data ?? []) as KanbanBoard[];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kanban Boards</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your project boards and track student work</p>
        </div>
        <div className="flex items-center gap-3">
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
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            + New Board
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading boards…</div>
      ) : boards.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-lg font-medium">No {statusFilter} boards yet</p>
          {statusFilter === 'active' && (
            <button onClick={() => setShowCreate(true)} className="mt-3 text-indigo-600 hover:underline text-sm">
              Create your first board
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map(board => (
            <BoardCard
              key={board.board_id}
              board={board}
              onArchive={id => archiveMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateBoardModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {}}
        />
      )}
    </div>
  );
}
