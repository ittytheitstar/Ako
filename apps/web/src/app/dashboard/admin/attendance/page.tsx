'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { AttendanceSession, AttendanceRecord } from '@ako/shared';

const STATUS_OPTIONS = ['present', 'late', 'absent', 'excused'] as const;
type Status = typeof STATUS_OPTIONS[number];

const statusColors: Record<Status, string> = {
  present: 'bg-green-100 text-green-700',
  late: 'bg-yellow-100 text-yellow-700',
  absent: 'bg-red-100 text-red-700',
  excused: 'bg-blue-100 text-blue-700',
};

export default function AdminAttendancePage() {
  const qc = useQueryClient();
  const [moduleId, setModuleId] = useState('');
  const [activeModuleId, setActiveModuleId] = useState('');
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null);
  const [showNewSession, setShowNewSession] = useState(false);
  const [sessionDate, setSessionDate] = useState('');
  const [sessionDesc, setSessionDesc] = useState('');
  const [recordEdits, setRecordEdits] = useState<Record<string, Status>>({});

  const sessionsQuery = useQuery({
    queryKey: ['admin-attendance-sessions', activeModuleId],
    queryFn: () => apiClient.getAttendanceSessions(activeModuleId),
    enabled: !!activeModuleId,
  });

  const recordsQuery = useQuery({
    queryKey: ['admin-attendance-records', activeModuleId, selectedSession?.session_id],
    queryFn: () => apiClient.getAttendanceRecords(activeModuleId, selectedSession!.session_id),
    enabled: !!selectedSession,
  });

  const summaryQuery = useQuery({
    queryKey: ['admin-attendance-summary', activeModuleId],
    queryFn: () => apiClient.getAttendanceSummary(activeModuleId),
    enabled: !!activeModuleId,
  });

  const createSession = useMutation({
    mutationFn: () =>
      apiClient.createAttendanceSession(activeModuleId, {
        session_date: sessionDate,
        description: sessionDesc || undefined,
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin-attendance-sessions', activeModuleId] });
      setShowNewSession(false);
      setSessionDate('');
      setSessionDesc('');
      setSelectedSession(data);
    },
  });

  const bulkUpsert = useMutation({
    mutationFn: () => {
      const records = Object.entries(recordEdits).map(([user_id, status]) => ({ user_id, status }));
      return apiClient.bulkUpsertAttendance(activeModuleId, selectedSession!.session_id, { records });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-attendance-records', activeModuleId, selectedSession?.session_id] });
      qc.invalidateQueries({ queryKey: ['admin-attendance-summary', activeModuleId] });
      setRecordEdits({});
    },
  });

  const sessions: AttendanceSession[] = sessionsQuery.data?.data ?? [];
  const records: AttendanceRecord[] = recordsQuery.data?.data ?? [];
  const summary = summaryQuery.data?.data ?? [];

  const getStatus = (record: AttendanceRecord): Status =>
    (recordEdits[record.user_id] ?? record.status) as Status;

  const loadSession = (session: AttendanceSession) => {
    setSelectedSession(session);
    setRecordEdits({});
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin — Attendance Roll</h1>
        <p className="text-sm text-gray-500 mt-1">Manage sessions and learner attendance records</p>
      </div>

      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Module ID</label>
          <input
            type="text" value={moduleId} onChange={(e) => setModuleId(e.target.value)}
            placeholder="Enter module ID…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={() => { setActiveModuleId(moduleId); setSelectedSession(null); setRecordEdits({}); }}
          disabled={!moduleId}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          Load
        </button>
      </div>

      {activeModuleId && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase">Sessions</p>
              <button
                onClick={() => setShowNewSession((v) => !v)}
                className="text-xs text-blue-600 hover:underline"
              >
                + New
              </button>
            </div>

            {showNewSession && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                <input
                  type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                />
                <input
                  type="text" value={sessionDesc} onChange={(e) => setSessionDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => createSession.mutate()}
                    disabled={!sessionDate || createSession.isPending}
                    className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {createSession.isPending ? 'Saving…' : 'Create'}
                  </button>
                  <button onClick={() => setShowNewSession(false)} className="text-xs text-gray-500">Cancel</button>
                </div>
              </div>
            )}

            {sessionsQuery.isLoading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-gray-400">No sessions yet.</p>
            ) : (
              <div className="space-y-1">
                {sessions.map((s) => (
                  <button
                    key={s.session_id}
                    onClick={() => loadSession(s)}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg ${
                      selectedSession?.session_id === s.session_id
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div>{new Date(s.session_date).toLocaleDateString()}</div>
                    {s.description && <div className="text-xs text-gray-400 truncate">{s.description}</div>}
                  </button>
                ))}
              </div>
            )}

            {summary.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase">Attendance Summary</p>
                <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {summary.map((s) => (
                    <div key={s.user_id} className="px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-700 truncate">{s.user_name ?? s.user_id.slice(-8)}</span>
                        <span className="text-xs font-medium text-blue-600">{s.percentage}%</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        P:{s.present} L:{s.late} A:{s.absent} E:{s.excused}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="col-span-2">
            {!selectedSession ? (
              <div className="flex items-center justify-center h-64 text-gray-400 bg-white border border-gray-100 rounded-lg">
                Select a session to view records
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {new Date(selectedSession.session_date).toLocaleDateString()}
                    </h2>
                    {selectedSession.description && (
                      <p className="text-sm text-gray-500">{selectedSession.description}</p>
                    )}
                  </div>
                  {Object.keys(recordEdits).length > 0 && (
                    <button
                      onClick={() => bulkUpsert.mutate()}
                      disabled={bulkUpsert.isPending}
                      className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {bulkUpsert.isPending ? 'Saving…' : 'Save Changes'}
                    </button>
                  )}
                </div>

                {recordsQuery.isLoading ? (
                  <div className="p-5 text-gray-500 text-sm">Loading records…</div>
                ) : records.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">No records for this session.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Learner', 'Status', 'Notes'].map((h) => (
                          <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {records.map((rec) => {
                        const currentStatus = getStatus(rec);
                        const isEdited = recordEdits[rec.user_id] !== undefined;
                        return (
                          <tr key={rec.record_id} className={`hover:bg-gray-50 ${isEdited ? 'bg-blue-50' : ''}`}>
                            <td className="px-4 py-3 text-gray-900">{rec.user_name ?? rec.user_id.slice(-8)}</td>
                            <td className="px-4 py-3">
                              <select
                                value={currentStatus}
                                onChange={(e) =>
                                  setRecordEdits((prev) => ({ ...prev, [rec.user_id]: e.target.value as Status }))
                                }
                                className={`text-xs font-medium px-2 py-1 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 cursor-pointer ${statusColors[currentStatus]}`}
                              >
                                {STATUS_OPTIONS.map((s) => (
                                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs">{rec.notes ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
