'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { CalendarEvent, ExternalCalendarSource, ExternalCalendarEvent } from '@ako/shared';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' });
}

const SOURCE_TYPE_COLOURS: Record<string, string> = {
  assignment: 'bg-amber-100 text-amber-700',
  quiz: 'bg-blue-100 text-blue-700',
  manual: 'bg-green-100 text-green-700',
  term: 'bg-gray-100 text-gray-700',
  announcement: 'bg-purple-100 text-purple-700',
};

export default function AdminCalendarPage() {
  const [activeTab, setActiveTab] = useState<'events' | 'external'>('events');
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [sourceForm, setSourceForm] = useState({ name: '', url: '', sync_interval_minutes: 60 });
  const [createForm, setCreateForm] = useState({
    title: '', description: '', start_at: '', end_at: '', all_day: false,
    recurrence_rule: '', context_type: 'system' as const, visibility: 'public' as const,
  });

  const queryClient = useQueryClient();

  // Fetch events for next 90 days
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['admin-calendar-events', now, future],
    queryFn: () => apiClient.getCalendarEvents({ from: now, to: future, limit: 200 }),
  });

  const { data: sourcesData, isLoading: sourcesLoading } = useQuery({
    queryKey: ['external-calendar-sources'],
    queryFn: () => apiClient.getExternalCalendarSources(),
  });

  const { data: extEventsData } = useQuery({
    queryKey: ['external-calendar-events', now, future],
    queryFn: () => apiClient.getExternalCalendarEvents({ from: now, to: future }),
  });

  const { data: icaltData } = useQuery({
    queryKey: ['ical-token'],
    queryFn: () => apiClient.getIcalToken(),
  });

  const createEventMutation = useMutation({
    mutationFn: (data: typeof createForm) => apiClient.createCalendarEvent({
      ...data,
      recurrence_rule: data.recurrence_rule || undefined,
      end_at: data.end_at || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-calendar-events'] });
      setShowCreateEventModal(false);
      setCreateForm({ title: '', description: '', start_at: '', end_at: '', all_day: false, recurrence_rule: '', context_type: 'system', visibility: 'public' });
    },
  });

  const addSourceMutation = useMutation({
    mutationFn: (data: typeof sourceForm) => apiClient.createExternalCalendarSource(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-calendar-sources'] });
      setShowAddSourceModal(false);
      setSourceForm({ name: '', url: '', sync_interval_minutes: 60 });
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteExternalCalendarSource(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['external-calendar-sources'] }),
  });

  const syncSourceMutation = useMutation({
    mutationFn: (id: string) => apiClient.syncExternalCalendarSource(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['external-calendar-sources'] }),
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteCalendarEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-calendar-events'] }),
  });

  const events = (eventsData?.data ?? []) as CalendarEvent[];
  const sources = (sourcesData?.data ?? []) as ExternalCalendarSource[];
  const extEvents = (extEventsData?.data ?? []) as ExternalCalendarEvent[];

  // Group events by date for the timeline view
  const grouped: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    const key = ev.start_at.slice(0, 10);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ev);
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Institutional Calendar</h1>
          <p className="text-gray-500 mt-1">Tenant-wide view of all events and academic dates</p>
        </div>
        <div className="flex items-center gap-3">
          {icaltData?.url && (
            <a
              href={icaltData.url}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
            >
              📅 Export Calendar
            </a>
          )}
          <button
            onClick={() => setShowCreateEventModal(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            + New Event
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {[
          { key: 'events', label: `Events (${events.length})` },
          { key: 'external', label: `External Sources (${sources.length})` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Events Tab */}
      {activeTab === 'events' && (
        <>
          {eventsLoading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              No institutional events in the next 90 days.
              <br />
              <button onClick={() => setShowCreateEventModal(true)} className="mt-3 text-blue-600 hover:underline text-sm">
                Create the first one
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([date, dayEvents]) => (
                <div key={date} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-700 text-sm">
                      {formatDate(date + 'T00:00:00')}
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {dayEvents.map(ev => (
                      <div key={ev.event_id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-medium text-gray-900 truncate">{ev.title}</p>
                            {ev.recurrence_rule && (
                              <span className="text-xs text-gray-400" title={ev.recurrence_rule}>↻</span>
                            )}
                          </div>
                          {ev.description && (
                            <p className="text-xs text-gray-500 truncate">{ev.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-400">
                            {ev.all_day ? 'All day' : formatTime(ev.start_at)}
                            {ev.end_at && !ev.all_day && ` – ${formatTime(ev.end_at)}`}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${SOURCE_TYPE_COLOURS[ev.source_type] ?? 'bg-gray-100 text-gray-600'}`}>
                            {ev.source_type}
                          </span>
                          <span className="text-xs text-gray-400 capitalize">{ev.context_type}</span>
                          <button
                            onClick={() => deleteEventMutation.mutate(ev.event_id)}
                            className="text-gray-300 hover:text-red-400 text-xs transition-colors"
                            title="Delete"
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* External events combined */}
          {extEvents.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                External Calendar Events ({extEvents.length})
              </h2>
              <div className="bg-white rounded-xl border border-indigo-100 overflow-hidden">
                <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                  {extEvents.map(ev => (
                    <div key={ev.ext_event_id} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{ev.title}</p>
                        {ev.description && <p className="text-xs text-gray-500 truncate">{ev.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-400">{formatDate(ev.start_at)}</span>
                        <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full truncate max-w-[100px]">
                          {ev.source_name}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* External Sources Tab */}
      {activeTab === 'external' && (
        <>
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => setShowAddSourceModal(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              + Add External Source
            </button>
          </div>
          {sourcesLoading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              No external calendar sources configured.
              <br />
              <button onClick={() => setShowAddSourceModal(true)} className="mt-3 text-blue-600 hover:underline text-sm">
                Add the first one
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sources.map(source => (
                <div key={source.source_id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900">{source.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${source.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {source.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate font-mono">{source.url}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Sync every {source.sync_interval_minutes} min
                      {source.last_synced_at && ` · Last synced: ${formatDate(source.last_synced_at)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => syncSourceMutation.mutate(source.source_id)}
                      disabled={syncSourceMutation.isPending}
                      className="px-3 py-1.5 text-xs border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                    >
                      ↻ Sync Now
                    </button>
                    <button
                      onClick={() => deleteSourceMutation.mutate(source.source_id)}
                      className="px-3 py-1.5 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add External Source Modal */}
      {showAddSourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add External iCal Source</h3>
              <button onClick={() => setShowAddSourceModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={sourceForm.name}
                  onChange={e => setSourceForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Public Holidays NZ"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">iCal URL *</label>
                <input
                  type="url"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                  value={sourceForm.url}
                  onChange={e => setSourceForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://example.com/calendar.ics"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Sync interval (minutes)</label>
                <input
                  type="number"
                  min={15}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={sourceForm.sync_interval_minutes}
                  onChange={e => setSourceForm(f => ({ ...f, sync_interval_minutes: parseInt(e.target.value) || 60 }))}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowAddSourceModal(false)}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!sourceForm.name || !sourceForm.url) return;
                  addSourceMutation.mutate(sourceForm);
                }}
                disabled={!sourceForm.name || !sourceForm.url || addSourceMutation.isPending}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {addSourceMutation.isPending ? 'Adding…' : 'Add Source'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {showCreateEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">New Institutional Event</h3>
              <button onClick={() => setShowCreateEventModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={createForm.title}
                  onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Event title"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                  rows={2}
                  value={createForm.description}
                  onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start *</label>
                  <input
                    type="datetime-local"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={createForm.start_at}
                    onChange={e => setCreateForm(f => ({ ...f, start_at: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">End</label>
                  <input
                    type="datetime-local"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={createForm.end_at}
                    onChange={e => setCreateForm(f => ({ ...f, end_at: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="all_day_admin"
                  checked={createForm.all_day}
                  onChange={e => setCreateForm(f => ({ ...f, all_day: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="all_day_admin" className="text-xs font-medium text-gray-700">All day event</label>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Recurrence (RRULE)</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                  value={createForm.recurrence_rule}
                  onChange={e => setCreateForm(f => ({ ...f, recurrence_rule: e.target.value }))}
                  placeholder="e.g. FREQ=YEARLY"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowCreateEventModal(false)}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!createForm.title || !createForm.start_at) return;
                  const startIso = new Date(createForm.start_at).toISOString();
                  const endIso = createForm.end_at ? new Date(createForm.end_at).toISOString() : undefined;
                  createEventMutation.mutate({ ...createForm, start_at: startIso, end_at: endIso ?? '' });
                }}
                disabled={!createForm.title || !createForm.start_at || createEventMutation.isPending}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {createEventMutation.isPending ? 'Creating…' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
