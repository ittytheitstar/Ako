'use client';
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { CalendarEvent } from '@ako/shared';

type CalendarView = 'month' | 'week' | 'agenda';

const EVENT_COLOURS: Record<string, string> = {
  assignment: 'bg-amber-100 text-amber-800 border-amber-200',
  quiz: 'bg-blue-100 text-blue-800 border-blue-200',
  manual: 'bg-green-100 text-green-800 border-green-200',
  announcement: 'bg-purple-100 text-purple-800 border-purple-200',
  term: 'bg-gray-100 text-gray-800 border-gray-200',
};

const EVENT_DOT_COLOURS: Record<string, string> = {
  assignment: 'bg-amber-400',
  quiz: 'bg-blue-400',
  manual: 'bg-green-400',
  announcement: 'bg-purple-400',
  term: 'bg-gray-400',
};

function formatDate(d: Date) {
  return d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function startOfWeek(d: Date) {
  const day = d.getDay();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
}

function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export default function CalendarPage() {
  const [view, setView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '', description: '', start_at: '', end_at: '', all_day: false,
    recurrence_rule: '', context_type: 'system' as 'course' | 'cohort' | 'system',
    visibility: 'public' as 'public' | 'grouping' | 'private',
  });

  const queryClient = useQueryClient();

  const { from, to } = useMemo(() => {
    if (view === 'month') {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      // Pad to full weeks
      const padStart = startOfWeek(start);
      const padEnd = addDays(startOfWeek(end), 6);
      return { from: padStart.toISOString(), to: padEnd.toISOString() };
    }
    if (view === 'week') {
      const start = startOfWeek(currentDate);
      return { from: start.toISOString(), to: addDays(start, 6).toISOString() };
    }
    // Agenda: next 30 days
    return { from: new Date().toISOString(), to: addDays(new Date(), 30).toISOString() };
  }, [view, currentDate]);

  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['calendar-events', from, to],
    queryFn: () => apiClient.getCalendarEvents({ from, to }),
  });

  const { data: icaltData } = useQuery({
    queryKey: ['ical-token'],
    queryFn: () => apiClient.getIcalToken(),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) => apiClient.createCalendarEvent({
      ...data,
      recurrence_rule: data.recurrence_rule || undefined,
      end_at: data.end_at || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      setShowCreateModal(false);
      setCreateForm({ title: '', description: '', start_at: '', end_at: '', all_day: false, recurrence_rule: '', context_type: 'system', visibility: 'public' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, scope }: { id: string; scope?: 'single' | 'all' }) =>
      apiClient.deleteCalendarEvent(id, { scope }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
  });

  const events = (eventsData?.data ?? []) as CalendarEvent[];

  const eventsOnDay = (day: Date) =>
    events.filter(e => isSameDay(new Date(e.start_at), day));

  const navigate = (dir: -1 | 1) => {
    if (view === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1));
    } else if (view === 'week') {
      setCurrentDate(addDays(currentDate, dir * 7));
    } else {
      setCurrentDate(addDays(currentDate, dir * 30));
    }
  };

  const headerLabel = () => {
    if (view === 'month') {
      return currentDate.toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' });
    }
    if (view === 'week') {
      const start = startOfWeek(currentDate);
      const end = addDays(start, 6);
      return `${formatDate(start)} – ${formatDate(end)}`;
    }
    return 'Next 30 Days';
  };

  const renderMonthView = () => {
    const start = startOfWeek(startOfMonth(currentDate));
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) days.push(addDays(start, i));
    const weeks: Date[][] = [];
    for (let i = 0; i < 6; i++) weeks.push(days.slice(i * 7, i * 7 + 7));

    return (
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase text-center">{d}</div>
          ))}
        </div>
        {/* Calendar grid */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-0">
            {week.map((day, di) => {
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isToday = isSameDay(day, new Date());
              const dayEvents = eventsOnDay(day).slice(0, 3);
              const moreCount = eventsOnDay(day).length - 3;
              return (
                <div
                  key={di}
                  className={`min-h-[80px] p-1.5 border-r border-gray-100 last:border-0 ${
                    isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-blue-600 text-white' : isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                  }`}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.map(ev => (
                      <div
                        key={ev.event_id}
                        className={`text-[10px] px-1 py-0.5 rounded truncate border ${EVENT_COLOURS[ev.source_type] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}
                        title={ev.title}
                      >
                        {!ev.all_day && <span className="mr-1 opacity-60">{formatTime(ev.start_at)}</span>}
                        {ev.title}
                      </div>
                    ))}
                    {moreCount > 0 && (
                      <div className="text-[10px] text-gray-400 px-1">+{moreCount} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const renderWeekView = () => {
    const start = startOfWeek(currentDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    return (
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {days.map((day, i) => (
            <div key={i} className={`p-3 text-center border-r border-gray-100 last:border-0 ${isSameDay(day, new Date()) ? 'bg-blue-50' : ''}`}>
              <p className="text-xs text-gray-500 uppercase">{day.toLocaleDateString('en-NZ', { weekday: 'short' })}</p>
              <p className={`text-lg font-semibold mt-0.5 ${isSameDay(day, new Date()) ? 'text-blue-600' : 'text-gray-900'}`}>
                {day.getDate()}
              </p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 min-h-[300px]">
          {days.map((day, i) => {
            const dayEvents = eventsOnDay(day);
            return (
              <div key={i} className={`border-r border-gray-100 last:border-0 p-1.5 space-y-1 ${isSameDay(day, new Date()) ? 'bg-blue-50/30' : 'bg-white'}`}>
                {dayEvents.map(ev => (
                  <div
                    key={ev.event_id}
                    className={`text-xs p-1.5 rounded border ${EVENT_COLOURS[ev.source_type] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}
                  >
                    {!ev.all_day && <p className="font-medium opacity-60 text-[10px]">{formatTime(ev.start_at)}</p>}
                    <p className="font-medium truncate">{ev.title}</p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAgendaView = () => {
    if (events.length === 0) {
      return (
        <div className="text-center py-16 text-gray-500">
          No upcoming events in the next 30 days.
        </div>
      );
    }

    // Group by date
    const grouped: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      const key = ev.start_at.slice(0, 10);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(ev);
    }

    return (
      <div className="space-y-4">
        {Object.entries(grouped).map(([date, dayEvents]) => (
          <div key={date} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-gray-700 text-sm">
                {formatDate(new Date(date + 'T00:00:00'))}
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {dayEvents.map(ev => (
                <div key={ev.event_id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${EVENT_DOT_COLOURS[ev.source_type] ?? 'bg-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{ev.title}</p>
                    {ev.description && (
                      <p className="text-xs text-gray-500 truncate">{ev.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {ev.all_day ? 'All day' : formatTime(ev.start_at)}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${EVENT_COLOURS[ev.source_type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ev.source_type}
                    </span>
                    <button
                      onClick={() => deleteMutation.mutate({ id: ev.event_id })}
                      className="text-gray-300 hover:text-red-400 transition-colors text-xs"
                      title="Delete event"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-500 mt-1">Your upcoming events, deadlines and schedule</p>
        </div>
        <div className="flex items-center gap-3">
          {icaltData?.url && (
            <a
              href={icaltData.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
              title="Subscribe with iCal"
            >
              📅 Subscribe (iCal)
            </a>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            + New Event
          </button>
        </div>
      </div>

      {/* View switcher + navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600">‹</button>
          <h2 className="text-base font-semibold text-gray-800 min-w-[200px] text-center">{headerLabel()}</h2>
          <button onClick={() => navigate(1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600">›</button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="ml-2 px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          >
            Today
          </button>
        </div>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          {(['month', 'week', 'agenda'] as CalendarView[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-sm capitalize ${view === v ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        {Object.entries(EVENT_DOT_COLOURS).map(([type, cls]) => (
          <span key={type} className="flex items-center gap-1 text-gray-500 capitalize">
            <span className={`w-2 h-2 rounded-full ${cls}`} />{type}
          </span>
        ))}
      </div>

      {/* Calendar content */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {view === 'month' && renderMonthView()}
          {view === 'week' && renderWeekView()}
          {view === 'agenda' && renderAgendaView()}
        </>
      )}

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">New Calendar Event</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
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
                  placeholder="Optional description"
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
                  id="all_day"
                  checked={createForm.all_day}
                  onChange={e => setCreateForm(f => ({ ...f, all_day: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="all_day" className="text-xs font-medium text-gray-700">All day event</label>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Recurrence (RRULE)</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                  value={createForm.recurrence_rule}
                  onChange={e => setCreateForm(f => ({ ...f, recurrence_rule: e.target.value }))}
                  placeholder="e.g. FREQ=WEEKLY;BYDAY=MO"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Context</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={createForm.context_type}
                    onChange={e => setCreateForm(f => ({ ...f, context_type: e.target.value as typeof f.context_type }))}
                  >
                    <option value="system">System</option>
                    <option value="course">Course</option>
                    <option value="cohort">Cohort</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Visibility</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={createForm.visibility}
                    onChange={e => setCreateForm(f => ({ ...f, visibility: e.target.value as typeof f.visibility }))}
                  >
                    <option value="public">Public</option>
                    <option value="grouping">Grouping</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!createForm.title || !createForm.start_at) return;
                  const startIso = new Date(createForm.start_at).toISOString();
                  const endIso = createForm.end_at ? new Date(createForm.end_at).toISOString() : '';
                  createMutation.mutate({ ...createForm, start_at: startIso, end_at: endIso });
                }}
                disabled={!createForm.title || !createForm.start_at || createMutation.isPending}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating…' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
