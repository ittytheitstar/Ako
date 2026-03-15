'use client';
import React, { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { KanbanLane, KanbanCard, KanbanCardTimeLog } from '@ako/shared';

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const PRIORITY_BADGE: Record<string, string> = {
  low:      'bg-sky-100 text-sky-700',
  medium:   'bg-amber-100 text-amber-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const FLAG_BADGE: Record<string, string> = {
  blocked:       'bg-red-200 text-red-800',
  urgent:        'bg-orange-200 text-orange-800',
  needs_review:  'bg-purple-200 text-purple-800',
};

// ─── Card Modal ─────────────────────────────────────────────────────────────

function CardModal({
  card,
  lanes,
  onClose,
}: {
  card: KanbanCard;
  lanes: KanbanLane[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [editTitle, setEditTitle] = useState(card.title);
  const [editDesc, setEditDesc] = useState(card.description ?? '');
  const [editPriority, setEditPriority] = useState(card.priority);
  const [editTags, setEditTags] = useState(card.tags.join(', '));
  const [logMinutes, setLogMinutes] = useState('');
  const [logNote, setLogNote] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: timeLogs } = useQuery({
    queryKey: ['card-time-logs', card.card_id],
    queryFn: () => apiClient.getKanbanCardTimeLogs(card.card_id),
  });

  const updateMutation = useMutation({
    mutationFn: (d: Partial<KanbanCard>) => apiClient.updateKanbanCard(card.card_id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kanban-board'] }); },
  });

  const moveMutation = useMutation({
    mutationFn: (laneId: string) => apiClient.moveKanbanCard(card.card_id, { lane_id: laneId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kanban-board'] }); },
  });

  const logTimeMutation = useMutation({
    mutationFn: () => apiClient.logKanbanCardTime(card.card_id, { minutes: parseInt(logMinutes, 10), note: logNote }),
    onSuccess: () => {
      setLogMinutes('');
      setLogNote('');
      qc.invalidateQueries({ queryKey: ['card-time-logs', card.card_id] });
      qc.invalidateQueries({ queryKey: ['kanban-board'] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => apiClient.archiveKanbanCard(card.card_id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kanban-board'] }); onClose(); },
  });

  async function handleSave() {
    setSaving(true);
    await updateMutation.mutateAsync({
      title: editTitle,
      description: editDesc,
      priority: editPriority,
      tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
    });
    setSaving(false);
    onClose();
  }

  const logs = timeLogs?.data ?? [];
  const totalMinutes = card.time_worked_minutes;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">Card Detail</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
            <input className="w-full border rounded px-3 py-2 text-sm" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <textarea className="w-full border rounded px-3 py-2 text-sm" rows={3} value={editDesc} onChange={e => setEditDesc(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
              <select className="w-full border rounded px-3 py-2 text-sm" value={editPriority} onChange={e => setEditPriority(e.target.value as KanbanCard['priority'])}>
                {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Move to Lane</label>
              <select className="w-full border rounded px-3 py-2 text-sm" value={card.lane_id} onChange={e => moveMutation.mutate(e.target.value)}>
                {lanes.map(l => <option key={l.lane_id} value={l.lane_id}>{l.title}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tags (comma-separated)</label>
            <input className="w-full border rounded px-3 py-2 text-sm" value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="frontend, backend, bug" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
            {card.start_date && <span>Start: {card.start_date}</span>}
            {card.end_date && <span>End: {card.end_date}</span>}
          <span>Time worked: {formatMinutes(totalMinutes)}</span>
            {card.story_points !== null && card.story_points !== undefined && (
              <span>Story points: {card.story_points}</span>
            )}
          </div>
          {card.flags.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {card.flags.map(f => (
                <span key={f} className={`px-2 py-0.5 rounded text-xs font-medium ${FLAG_BADGE[f] ?? 'bg-gray-100 text-gray-700'}`}>{f}</span>
              ))}
            </div>
          )}

          {/* Time Logging */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Log Time</h3>
            <div className="flex gap-2 mb-3">
              <input
                type="number"
                min="1"
                className="border rounded px-2 py-1.5 text-sm w-24"
                placeholder="mins"
                value={logMinutes}
                onChange={e => setLogMinutes(e.target.value)}
              />
              <input
                className="border rounded px-2 py-1.5 text-sm flex-1"
                placeholder="Note (optional)"
                value={logNote}
                onChange={e => setLogNote(e.target.value)}
              />
              <button
                disabled={!logMinutes || logTimeMutation.isPending}
                onClick={() => logTimeMutation.mutate()}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded disabled:opacity-50"
              >
                Log
              </button>
            </div>
            {logs.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {logs.map((l: KanbanCardTimeLog) => (
                  <div key={l.time_log_id} className="text-xs text-gray-500 flex justify-between">
                    <span>{l.user_display_name ?? 'Unknown'} — {l.minutes}m</span>
                    <span>{l.note ?? ''}</span>
                    <span>{new Date(l.logged_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between p-4 border-t">
          <button
            onClick={() => archiveMutation.mutate()}
            className="text-sm text-red-600 hover:underline"
          >
            Archive Card
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border rounded text-gray-600 hover:bg-gray-50">Cancel</button>
            <button
              disabled={saving}
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Lane Column ─────────────────────────────────────────────────────────────

function LaneColumn({
  lane,
  cards,
  allLanes,
  onCardClick,
  onAddCard,
}: {
  lane: KanbanLane;
  cards: KanbanCard[];
  allLanes: KanbanLane[];
  onCardClick: (card: KanbanCard) => void;
  onAddCard: (laneId: string) => void;
}) {
  const atWip = lane.wip_limit > 0 && cards.length >= lane.wip_limit;

  return (
    <div className="w-64 shrink-0 flex flex-col">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lane.color }} />
          <span className="font-semibold text-sm text-gray-800 truncate">{lane.title}</span>
          <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-1.5">{cards.length}</span>
          {lane.wip_limit > 0 && (
            <span className={`text-xs rounded-full px-1.5 ${atWip ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
              /{lane.wip_limit}
            </span>
          )}
          {lane.is_done_lane && <span className="text-xs text-green-600">✓</span>}
        </div>
      </div>

      <div className="flex-1 bg-gray-50 rounded-lg p-2 space-y-2 min-h-[120px]">
        {cards.map(card => (
          <div
            key={card.card_id}
            onClick={() => onCardClick(card)}
            className="bg-white rounded-md p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow border border-gray-100"
          >
            <p className="text-sm font-medium text-gray-800 leading-tight">{card.title}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <span className={`text-xs px-1.5 rounded ${PRIORITY_BADGE[card.priority]}`}>{card.priority}</span>
              {card.flags.map(f => (
                <span key={f} className={`text-xs px-1.5 rounded ${FLAG_BADGE[f] ?? 'bg-gray-100 text-gray-600'}`}>{f}</span>
              ))}
              {card.tags.slice(0, 2).map(t => (
                <span key={t} className="text-xs px-1.5 rounded bg-blue-50 text-blue-700">{t}</span>
              ))}
            </div>
            {(card.end_date || card.story_points) && (
              <div className="mt-1.5 flex gap-2 text-xs text-gray-400">
                {card.end_date && <span>📅 {card.end_date}</span>}
                {card.story_points && <span>⚡ {card.story_points}pt</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={() => onAddCard(lane.lane_id)}
        className="mt-2 w-full text-sm text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg py-2 border border-dashed border-gray-300 hover:border-indigo-300 transition-colors"
      >
        + Add Card
      </button>
    </div>
  );
}

// ─── Add Card Form ────────────────────────────────────────────────────────────

function AddCardForm({
  boardId,
  laneId,
  onClose,
}: {
  boardId: string;
  laneId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<KanbanCard['priority']>('medium');

  const createMutation = useMutation({
    mutationFn: () => apiClient.createKanbanCard(boardId, { lane_id: laneId, title, priority }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kanban-board'] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm">
        <h2 className="font-bold mb-3">Add Card</h2>
        <div className="space-y-3">
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Card title *"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <select className="w-full border rounded px-3 py-2 text-sm" value={priority} onChange={e => setPriority(e.target.value as KanbanCard['priority'])}>
            {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        {createMutation.error && <p className="text-red-600 text-sm mt-2">{String(createMutation.error)}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded text-gray-600">Cancel</button>
          <button
            disabled={!title || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded disabled:opacity-50"
          >
            Add Card
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Board Page ──────────────────────────────────────────────────────────

export default function KanbanBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [addCardLane, setAddCardLane] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['kanban-board', id],
    queryFn: () => apiClient.getKanbanBoard(id),
  });

  const archiveMutation = useMutation({
    mutationFn: () => apiClient.archiveKanbanBoard(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kanban-board', id] }),
  });

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading board…</div>;
  if (!data) return <div className="p-8 text-center text-red-400">Board not found.</div>;

  const board = data;
  const lanes: KanbanLane[] = board.lanes ?? [];
  const cards: KanbanCard[] = board.cards ?? [];

  const cardsByLane = lanes.reduce((acc, lane) => {
    acc[lane.lane_id] = cards.filter(c => c.lane_id === lane.lane_id);
    return acc;
  }, {} as Record<string, KanbanCard[]>);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <a href="/dashboard/kanban" className="text-gray-400 hover:text-gray-600 text-sm">← Boards</a>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-bold text-gray-900">{board.title}</h1>
            {board.status === 'archived' && (
              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">Archived</span>
            )}
          </div>
          {board.description && (
            <p className="text-sm text-gray-500 mt-0.5">{board.description}</p>
          )}
        </div>
        {board.status === 'active' && (
          <button
            onClick={() => archiveMutation.mutate()}
            className="text-sm text-gray-500 hover:text-red-600 border rounded px-3 py-1.5"
          >
            Archive Board
          </button>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full items-start">
          {lanes.map(lane => (
            <LaneColumn
              key={lane.lane_id}
              lane={lane}
              cards={cardsByLane[lane.lane_id] ?? []}
              allLanes={lanes}
              onCardClick={setSelectedCard}
              onAddCard={setAddCardLane}
            />
          ))}
          {lanes.length === 0 && (
            <div className="text-center text-gray-400 py-16 w-full">
              No lanes found. The board may still be loading.
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedCard && (
        <CardModal
          card={selectedCard}
          lanes={lanes}
          onClose={() => setSelectedCard(null)}
        />
      )}
      {addCardLane && (
        <AddCardForm
          boardId={id}
          laneId={addCardLane}
          onClose={() => setAddCardLane(null)}
        />
      )}
    </div>
  );
}
