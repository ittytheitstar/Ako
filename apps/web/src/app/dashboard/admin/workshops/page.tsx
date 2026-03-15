'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { WorkshopSubmission } from '@ako/shared';

const phaseLabels: Record<string, string> = {
  setup: 'Setup', submission: 'Submission', assessment: 'Peer Assessment',
  grading: 'Grading', closed: 'Closed',
};

const phaseColors: Record<string, string> = {
  setup: 'bg-gray-100 text-gray-700', submission: 'bg-blue-100 text-blue-700',
  assessment: 'bg-yellow-100 text-yellow-700', grading: 'bg-purple-100 text-purple-700',
  closed: 'bg-green-100 text-green-700',
};

export default function AdminWorkshopsPage() {
  const qc = useQueryClient();
  const [moduleId, setModuleId] = useState('');
  const [activeModuleId, setActiveModuleId] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  const [peerCount, setPeerCount] = useState(3);
  const [subWeight, setSubWeight] = useState(50);
  const [assessWeight, setAssessWeight] = useState(50);
  const [selfAssessment, setSelfAssessment] = useState(false);
  const [allocationStrategy, setAllocationStrategy] = useState<'random' | 'manual'>('random');
  const [submissionEnd, setSubmissionEnd] = useState('');
  const [assessmentEnd, setAssessmentEnd] = useState('');

  const workshopQuery = useQuery({
    queryKey: ['admin-workshop', activeModuleId],
    queryFn: () => apiClient.getWorkshop(activeModuleId),
    enabled: !!activeModuleId,
  });

  const submissionsQuery = useQuery({
    queryKey: ['admin-workshop-submissions', activeModuleId],
    queryFn: () => apiClient.getWorkshopSubmissions(activeModuleId),
    enabled: !!activeModuleId,
  });

  const upsertWorkshop = useMutation({
    mutationFn: () =>
      apiClient.upsertWorkshop(activeModuleId, {
        peer_count: peerCount,
        submission_weight: subWeight,
        assessment_weight: assessWeight,
        self_assessment: selfAssessment,
        allocation_strategy: allocationStrategy,
        submission_end_at: submissionEnd || undefined,
        assessment_end_at: assessmentEnd || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-workshop', activeModuleId] });
      setShowConfig(false);
    },
  });

  const advancePhase = useMutation({
    mutationFn: () => apiClient.advanceWorkshopPhase(activeModuleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-workshop', activeModuleId] }),
  });

  const allocatePeers = useMutation({
    mutationFn: () => apiClient.allocateWorkshopPeers(activeModuleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-workshop', activeModuleId] }),
  });

  const workshop = workshopQuery.data;
  const submissions: WorkshopSubmission[] = submissionsQuery.data?.data ?? [];

  const openConfig = () => {
    if (workshop) {
      setPeerCount(workshop.peer_count);
      setSubWeight(workshop.submission_weight);
      setAssessWeight(workshop.assessment_weight);
      setSelfAssessment(workshop.self_assessment);
      setAllocationStrategy(workshop.allocation_strategy);
      setSubmissionEnd(workshop.submission_end_at ? new Date(workshop.submission_end_at).toISOString().slice(0, 16) : '');
      setAssessmentEnd(workshop.assessment_end_at ? new Date(workshop.assessment_end_at).toISOString().slice(0, 16) : '');
    }
    setShowConfig(true);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin — Workshops</h1>
        <p className="text-sm text-gray-500 mt-1">Configure workshop phases and monitor submissions</p>
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
          onClick={() => setActiveModuleId(moduleId)}
          disabled={!moduleId}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          Load
        </button>
      </div>

      {workshopQuery.isLoading && <p className="text-gray-500 text-sm">Loading…</p>}

      {activeModuleId && workshop && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900">Workshop Status</h2>
                <span className={`text-sm font-medium px-3 py-1 rounded-full ${phaseColors[workshop.phase] ?? ''}`}>
                  {phaseLabels[workshop.phase] ?? workshop.phase}
                </span>
              </div>
              <button onClick={openConfig} className="text-sm text-blue-600 hover:underline">Edit Settings</button>
            </div>

            {!showConfig && (
              <div className="flex flex-wrap gap-6 text-sm text-gray-600">
                <span>Peer count: <strong>{workshop.peer_count}</strong></span>
                <span>Submission weight: <strong>{workshop.submission_weight}%</strong></span>
                <span>Assessment weight: <strong>{workshop.assessment_weight}%</strong></span>
                <span>Self-assessment: <strong>{workshop.self_assessment ? 'Yes' : 'No'}</strong></span>
                <span>Allocation: <strong>{workshop.allocation_strategy}</strong></span>
                {workshop.submission_end_at && <span>Sub ends: <strong>{new Date(workshop.submission_end_at).toLocaleString()}</strong></span>}
                {workshop.assessment_end_at && <span>Assess ends: <strong>{new Date(workshop.assessment_end_at).toLocaleString()}</strong></span>}
              </div>
            )}

            {showConfig && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Peer Count</label>
                    <input type="number" min={1} value={peerCount} onChange={(e) => setPeerCount(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Submission Weight</label>
                    <input type="number" min={0} max={100} step={1} value={subWeight} onChange={(e) => setSubWeight(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Assessment Weight</label>
                    <input type="number" min={0} max={100} step={1} value={assessWeight} onChange={(e) => setAssessWeight(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Submission End</label>
                    <input type="datetime-local" value={submissionEnd} onChange={(e) => setSubmissionEnd(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Assessment End</label>
                    <input type="datetime-local" value={assessmentEnd} onChange={(e) => setAssessmentEnd(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={selfAssessment} onChange={(e) => setSelfAssessment(e.target.checked)} className="accent-blue-600" />
                    Self-Assessment
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700">Allocation:</label>
                    <select value={allocationStrategy} onChange={(e) => setAllocationStrategy(e.target.value as 'random' | 'manual')}
                      className="border border-gray-300 rounded px-2 py-1 text-sm">
                      <option value="random">Random</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => upsertWorkshop.mutate()}
                    disabled={upsertWorkshop.isPending}
                    className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {upsertWorkshop.isPending ? 'Saving…' : 'Save Settings'}
                  </button>
                  <button onClick={() => setShowConfig(false)} className="text-sm text-gray-500 px-3 py-2">Cancel</button>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button
                onClick={() => advancePhase.mutate()}
                disabled={advancePhase.isPending || workshop.phase === 'closed'}
                className="text-sm bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {advancePhase.isPending ? 'Advancing…' : '→ Advance Phase'}
              </button>
              {workshop.phase === 'assessment' && (
                <button
                  onClick={() => allocatePeers.mutate()}
                  disabled={allocatePeers.isPending}
                  className="text-sm bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                >
                  {allocatePeers.isPending ? 'Allocating…' : 'Allocate Peers'}
                </button>
              )}
              {allocatePeers.isSuccess && (
                <span className="text-sm text-green-600 self-center">
                  ✓ Allocated {(allocatePeers.data as { allocated: number }).allocated} pairs
                </span>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Submissions ({submissions.length})</h2>
            </div>
            {submissionsQuery.isLoading ? (
              <div className="p-5 text-gray-500 text-sm">Loading…</div>
            ) : submissions.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No submissions yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Author', 'Title', 'Grade', 'Submitted'].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {submissions.map((s: WorkshopSubmission) => (
                    <tr key={s.submission_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">{s.author_name ?? s.author_id.slice(-8)}</td>
                      <td className="px-4 py-3 text-gray-900">{s.title}</td>
                      <td className="px-4 py-3 text-gray-500">{s.grade ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(s.submitted_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
