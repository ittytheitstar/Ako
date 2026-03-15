'use client';
import React, { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { AttendanceSummary, AttendanceSession } from '@ako/shared';

const statusColors: Record<string, string> = {
  present: 'bg-green-100 text-green-700',
  late: 'bg-yellow-100 text-yellow-700',
  absent: 'bg-red-100 text-red-700',
  excused: 'bg-blue-100 text-blue-700',
};

export default function AttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();

  const [selectedSession, setSelectedSession] = useState<string>('');
  const [selfStatus, setSelfStatus] = useState<'present' | 'late' | 'absent' | 'excused'>('present');

  const sessionsQuery = useQuery({
    queryKey: ['attendance-sessions', id],
    queryFn: () => apiClient.getAttendanceSessions(id),
  });

  const summaryQuery = useQuery({
    queryKey: ['attendance-summary', id],
    queryFn: () => apiClient.getAttendanceSummary(id),
  });

  const selfReport = useMutation({
    mutationFn: () => apiClient.selfReportAttendance(id, selectedSession, { status: selfStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance-summary', id] });
      setSelectedSession('');
    },
  });

  const sessions: AttendanceSession[] = sessionsQuery.data?.data ?? [];
  const summary: AttendanceSummary[] = summaryQuery.data?.data ?? [];
  const mySummary = summary[0];

  if (sessionsQuery.isLoading || summaryQuery.isLoading) {
    return <div className="p-6 text-gray-500">Loading…</div>;
  }
  if (sessionsQuery.isError) {
    return <div className="p-6 text-red-600">Failed to load attendance data.</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
        <p className="text-sm text-gray-500 mt-1">Your attendance record for this module</p>
      </div>

      {mySummary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: 'Present', count: mySummary.present, color: 'bg-green-50 text-green-700 border-green-200' },
            { label: 'Late', count: mySummary.late, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
            { label: 'Absent', count: mySummary.absent, color: 'bg-red-50 text-red-700 border-red-200' },
            { label: 'Excused', count: mySummary.excused, color: 'bg-blue-50 text-blue-700 border-blue-200' },
            { label: 'Present %', count: `${mySummary.percentage}%`, color: 'bg-gray-50 text-gray-700 border-gray-200' },
          ].map(({ label, count, color }) => (
            <div key={label} className={`border rounded-lg p-4 text-center ${color}`}>
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs font-medium mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Self-Report Attendance</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Session</label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select a session…</option>
              {sessions.map((s) => (
                <option key={s.session_id} value={s.session_id}>
                  {new Date(s.session_date).toLocaleDateString()}{s.description ? ` — ${s.description}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select
              value={selfStatus}
              onChange={(e) => setSelfStatus(e.target.value as typeof selfStatus)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
              <option value="excused">Excused</option>
            </select>
          </div>
        </div>
        <button
          onClick={() => selfReport.mutate()}
          disabled={!selectedSession || selfReport.isPending}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          {selfReport.isPending ? 'Submitting…' : 'Submit'}
        </button>
        {selfReport.isSuccess && <p className="text-green-600 text-sm">✓ Attendance recorded.</p>}
        {selfReport.isError && <p className="text-red-600 text-sm">Failed to submit attendance.</p>}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Sessions</h2>
        </div>
        {sessions.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-400 text-sm">No sessions scheduled yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Date', 'Description'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sessions.map((s) => (
                <tr key={s.session_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{new Date(s.session_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-500">{s.description ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
