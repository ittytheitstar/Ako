'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { Programme, CompetencyFramework, ProgrammeCompetencyReport } from '@ako/shared';

const RATING_COLORS: Record<string, string> = {
  not_yet:    'bg-gray-100',
  beginning:  'bg-red-100',
  developing: 'bg-amber-100',
  proficient: 'bg-green-100',
  advanced:   'bg-teal-100',
};

export default function ProgrammesPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'report'>('details');
  const [form, setForm] = useState({ name: '', code: '', description: '', framework_id: '', course_ids: '' });
  const [msg, setMsg] = useState('');

  const { data: progData, isLoading } = useQuery({
    queryKey: ['programmes'],
    queryFn: () => apiClient.getProgrammes(),
  });

  const { data: progDetail } = useQuery({
    queryKey: ['programme', selectedId],
    queryFn: () => apiClient.getProgramme(selectedId!),
    enabled: !!selectedId,
  });

  const { data: reportData, refetch: refetchReport } = useQuery({
    queryKey: ['programme-report', selectedId],
    queryFn: () => apiClient.getProgrammeReport(selectedId!),
    enabled: !!selectedId && activeTab === 'report',
  });

  const { data: fwData } = useQuery({
    queryKey: ['competency-frameworks'],
    queryFn: () => apiClient.getCompetencyFrameworks(),
  });

  const programmes = (progData?.data ?? []) as Programme[];
  const frameworks = (fwData?.data ?? []) as CompetencyFramework[];
  const reports = (reportData?.data ?? []) as ProgrammeCompetencyReport[];

  const createMutation = useMutation({
    mutationFn: () => apiClient.createProgramme({
      name: form.name,
      code: form.code,
      description: form.description || undefined,
      framework_id: form.framework_id || undefined,
      course_ids: form.course_ids ? form.course_ids.split(',').map(s => s.trim()).filter(Boolean) : [],
    }),
    onSuccess: (prog) => {
      qc.invalidateQueries({ queryKey: ['programmes'] });
      setShowCreate(false);
      setSelectedId(prog.programme_id);
      setForm({ name: '', code: '', description: '', framework_id: '', course_ids: '' });
      setMsg('Programme created.');
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiClient.refreshProgrammeReport(selectedId!),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['programme-report', selectedId] });
      setMsg(`Report refreshed. ${res.refreshed} competencies calculated across ${res.total_learners} learners.`);
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const detail = progDetail as (Programme & { courses?: { course_id: string; title: string; course_code: string }[] }) | undefined;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Programme Builder</h1>
        <button
          onClick={() => { setShowCreate(true); setMsg(''); }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
        >
          + New Programme
        </button>
      </div>

      {msg && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-800 text-sm">
          {msg}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-gray-700">New Programme</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="Programme name *"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
            <input
              className="border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="Code (e.g. BAT) *"
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
            />
          </div>
          <textarea
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="Description (optional)"
            rows={2}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
          <select
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            value={form.framework_id}
            onChange={e => setForm(f => ({ ...f, framework_id: e.target.value }))}
          >
            <option value="">— Select competency framework (optional) —</option>
            {frameworks.map(fw => (
              <option key={fw.framework_id} value={fw.framework_id}>{fw.name}</option>
            ))}
          </select>
          <input
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="Course UUIDs (comma-separated)"
            value={form.course_ids}
            onChange={e => setForm(f => ({ ...f, course_ids: e.target.value }))}
          />
          <div className="flex gap-2">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!form.name || !form.code || createMutation.isPending}
              className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-300 rounded text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Programme list */}
        <div className="col-span-1 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800 text-sm">Programmes</h2>
          </div>
          {isLoading && <p className="p-4 text-gray-500 text-sm">Loading…</p>}
          {programmes.length === 0 && !isLoading && (
            <p className="p-4 text-gray-500 text-sm">No programmes yet.</p>
          )}
          <div className="divide-y divide-gray-100">
            {programmes.map(prog => (
              <div
                key={prog.programme_id}
                onClick={() => { setSelectedId(prog.programme_id); setActiveTab('details'); setMsg(''); }}
                className={`px-4 py-3 cursor-pointer hover:bg-indigo-50 ${selectedId === prog.programme_id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''}`}
              >
                <p className="font-medium text-gray-800 text-sm">{prog.name}</p>
                <p className="text-xs text-gray-500">{prog.code} · {prog.course_ids.length} courses</p>
                {prog.framework_name && (
                  <p className="text-xs text-indigo-600 mt-0.5">{prog.framework_name}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="col-span-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
          {!selectedId && (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              Select a programme to view details or attainment report
            </div>
          )}

          {selectedId && detail && (
            <>
              {/* Tabs */}
              <div className="flex border-b border-gray-200">
                {(['details', 'report'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-3 text-sm font-medium capitalize ${activeTab === tab ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {tab === 'report' ? 'Attainment Report' : 'Details'}
                  </button>
                ))}
              </div>

              {/* Details tab */}
              {activeTab === 'details' && (
                <div className="p-4 space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{detail.name}</h2>
                    <p className="text-sm text-gray-500">{detail.code}</p>
                    {detail.description && <p className="text-sm text-gray-700 mt-1">{detail.description}</p>}
                    {detail.framework_name && (
                      <p className="text-sm text-indigo-600 mt-1">Framework: {detail.framework_name}</p>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Courses ({(detail.courses ?? []).length})</h3>
                    {(detail.courses ?? []).length === 0 && (
                      <p className="text-sm text-gray-500">No courses assigned.</p>
                    )}
                    <div className="space-y-1">
                      {(detail.courses ?? []).map(c => (
                        <div key={c.course_id} className="flex items-center gap-2 text-sm">
                          <span className="w-2 h-2 rounded-full bg-indigo-400" />
                          <span className="font-medium text-gray-800">{c.title}</span>
                          <span className="text-gray-400 text-xs">{c.course_code}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Attainment Report tab */}
              {activeTab === 'report' && (
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700">Competency Attainment by Cohort</h3>
                    <button
                      onClick={() => { setMsg(''); refreshMutation.mutate(); }}
                      disabled={refreshMutation.isPending}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {refreshMutation.isPending ? 'Refreshing…' : 'Refresh Report'}
                    </button>
                  </div>

                  {reports.length === 0 && (
                    <p className="text-sm text-gray-500">No report data yet. Click &quot;Refresh Report&quot; to generate.</p>
                  )}

                  {reports.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 pr-4 font-medium text-gray-600">Competency</th>
                            <th className="text-center py-2 px-2 font-medium text-gray-600">Learners</th>
                            <th className="text-center py-2 px-2 font-medium text-gray-600 bg-green-50">Proficient+</th>
                            <th className="text-left py-2 pl-2 font-medium text-gray-600">Distribution</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {reports.map(r => (
                            <tr key={r.report_id}>
                              <td className="py-2 pr-4 font-medium text-gray-800">
                                {r.competency_short_name ?? r.competency_id}
                              </td>
                              <td className="py-2 px-2 text-center text-gray-600">{r.total_learners}</td>
                              <td className="py-2 px-2 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${Number(r.proficient_pct) >= 70 ? 'bg-green-100 text-green-800' : Number(r.proficient_pct) >= 40 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                                  {Number(r.proficient_pct).toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-2 pl-2">
                                <div className="flex gap-1">
                                  {[
                                    { key: 'not_yet', val: r.not_yet_count },
                                    { key: 'beginning', val: r.beginning_count },
                                    { key: 'developing', val: r.developing_count },
                                    { key: 'proficient', val: r.proficient_count },
                                    { key: 'advanced', val: r.advanced_count },
                                  ].map(({ key, val }) => val > 0 && (
                                    <span key={key} title={`${key}: ${val}`} className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-xs ${RATING_COLORS[key]}`}>
                                      {val}
                                    </span>
                                  ))}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
