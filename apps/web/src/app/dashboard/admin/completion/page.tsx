'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import type {
  Course,
  LearnerProgressRow,
  CourseCompletionCriterion,
  CompletionCriterionType,
} from '@ako/shared';

const criterionTypeLabels: Record<CompletionCriterionType, string> = {
  all_modules: 'All tracked activities complete',
  required_modules: 'Specific activities complete',
  min_grade: 'Minimum grade achieved',
  required_date: 'Required enrolment date',
};

export default function CompletionAdminPage() {
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [addCriterionType, setAddCriterionType] = useState<CompletionCriterionType>('all_modules');
  const [addCriterionSettings, setAddCriterionSettings] = useState('{}');
  const [settingsError, setSettingsError] = useState<string>('');
  const queryClient = useQueryClient();

  const coursesQuery = useQuery({
    queryKey: ['courses'],
    queryFn: () => apiClient.getCourses(),
  });

  const progressSummaryQuery = useQuery({
    queryKey: ['course-progress-summary', selectedCourseId],
    queryFn: () => apiClient.getCourseProgressSummary(selectedCourseId),
    enabled: !!selectedCourseId,
  });

  const criteriaQuery = useQuery({
    queryKey: ['course-criteria', selectedCourseId],
    queryFn: () => apiClient.getCourseCompletionCriteria(selectedCourseId),
    enabled: !!selectedCourseId,
  });

  const addCriterion = useMutation({
    mutationFn: () => {
      let settings: Record<string, unknown> = {};
      try {
        settings = JSON.parse(addCriterionSettings);
        setSettingsError('');
      } catch {
        setSettingsError('Invalid JSON. Please fix the settings before saving.');
        throw new Error('Invalid settings JSON');
      }
      return apiClient.addCourseCompletionCriterion(selectedCourseId, {
        criterion_type: addCriterionType,
        settings,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-criteria', selectedCourseId] });
      setAddCriterionSettings('{}');
    },
  });

  const deleteCriterion = useMutation({
    mutationFn: (criterionId: string) =>
      apiClient.deleteCourseCompletionCriterion(selectedCourseId, criterionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-criteria', selectedCourseId] });
    },
  });

  const evaluateAll = useMutation({
    mutationFn: () => apiClient.evaluateCourseCompletion(selectedCourseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-progress-summary', selectedCourseId] });
    },
  });

  const courses = (coursesQuery.data?.data ?? []) as Course[];
  const progressRows = (progressSummaryQuery.data?.data ?? []) as LearnerProgressRow[];
  const criteria = (criteriaQuery.data?.data ?? []) as CourseCompletionCriterion[];

  const stateColour = (state: string) => {
    if (state === 'complete') return 'bg-green-100 text-green-700';
    if (state === 'in_progress') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-500';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Completion Management</h1>
          <p className="text-sm text-gray-500 mt-1">Configure completion criteria and review learner progress</p>
        </div>
        <Link href="/dashboard/admin" className="text-sm text-blue-600 hover:underline">
          ← Admin
        </Link>
      </div>

      {/* Course selector */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Course</label>
        <select
          value={selectedCourseId}
          onChange={e => setSelectedCourseId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Choose a course…</option>
          {courses.map(c => (
            <option key={c.course_id} value={c.course_id}>
              {c.course_code} – {c.title}
            </option>
          ))}
        </select>
      </div>

      {selectedCourseId && (
        <>
          {/* Completion criteria */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Completion Criteria</h2>
              <button
                onClick={() => evaluateAll.mutate()}
                disabled={evaluateAll.isPending}
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {evaluateAll.isPending ? 'Evaluating…' : '↺ Re-evaluate All'}
              </button>
            </div>

            {criteriaQuery.isLoading && <p className="text-gray-500 text-sm">Loading criteria…</p>}
            {criteria.length === 0 && !criteriaQuery.isLoading && (
              <p className="text-gray-400 text-sm">No completion criteria configured. Add one below.</p>
            )}
            {criteria.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                {criteria.map((c: CourseCompletionCriterion) => (
                  <div key={c.criterion_id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{criterionTypeLabels[c.criterion_type]}</p>
                      {Object.keys(c.settings).length > 0 && (
                        <p className="text-xs text-gray-500 font-mono mt-0.5">{JSON.stringify(c.settings)}</p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteCriterion.mutate(c.criterion_id)}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add criterion form */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Add Criterion</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Type</label>
                  <select
                    value={addCriterionType}
                    onChange={e => setAddCriterionType(e.target.value as CompletionCriterionType)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {(Object.entries(criterionTypeLabels) as [CompletionCriterionType, string][]).map(([t, l]) => (
                      <option key={t} value={t}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Settings (JSON)</label>
                  <input
                    type="text"
                    value={addCriterionSettings}
                    onChange={e => { setAddCriterionSettings(e.target.value); setSettingsError(''); }}
                    placeholder='{"min_grade": 60}'
                    className={`w-full border rounded-lg px-3 py-2 text-sm font-mono ${settingsError ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {settingsError && <p className="text-xs text-red-600 mt-1">{settingsError}</p>}
                </div>
              </div>
              <button
                onClick={() => addCriterion.mutate()}
                disabled={addCriterion.isPending}
                className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {addCriterion.isPending ? 'Adding…' : '+ Add Criterion'}
              </button>
            </div>
          </section>

          {/* Learner progress table */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Learner Progress</h2>
            {progressSummaryQuery.isLoading && <p className="text-gray-500 text-sm">Loading progress…</p>}
            {progressRows.length === 0 && !progressSummaryQuery.isLoading && (
              <p className="text-gray-400 text-sm">No completion data yet for this course.</p>
            )}
            {progressRows.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Learner', 'Email', 'Progress', 'Status', 'Completed', 'Last Evaluated'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {progressRows.map((row: LearnerProgressRow) => (
                      <tr key={row.user_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{row.display_name}</td>
                        <td className="px-4 py-3 text-gray-500">{row.email}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-2 w-24">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${row.progress_pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">{row.progress_pct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stateColour(row.state)}`}>
                            {row.state.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {row.completed_at ? new Date(row.completed_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {row.last_evaluated_at ? new Date(row.last_evaluated_at).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
