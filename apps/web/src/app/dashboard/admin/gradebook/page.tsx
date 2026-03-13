'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import type { Course, GradeItem, GradeCategory, MarkingWorkflowStateRecord, MarkingWorkflowState } from '@ako/shared';

const workflowStateColours: Record<MarkingWorkflowState, string> = {
  unmarked: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  ready_for_release: 'bg-yellow-100 text-yellow-700',
  released: 'bg-green-100 text-green-700',
};

export default function AdminGradebookPage() {
  const qc = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [activeTab, setActiveTab] = useState<'grades' | 'categories' | 'workflow'>('grades');
  const [releaseTarget, setReleaseTarget] = useState<'course' | 'category'>('course');
  const [releaseCategoryId, setReleaseCategoryId] = useState('');

  // Quick grade entry state
  const [editingGrades, setEditingGrades] = useState<Record<string, Record<string, string>>>({});

  // Category form
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', aggregation_strategy: 'weighted_mean', drop_lowest: 0, weight: 100, parent_id: '' });

  // Import
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);

  const coursesQuery = useQuery({
    queryKey: ['courses'],
    queryFn: () => apiClient.getCourses(),
  });

  const gradeItemsQuery = useQuery({
    queryKey: ['grade-items', selectedCourseId],
    queryFn: () => apiClient.getGradeItems(selectedCourseId),
    enabled: !!selectedCourseId,
  });

  const gradesQuery = useQuery({
    queryKey: ['grades', selectedCourseId],
    queryFn: async () => {
      const items = gradeItemsQuery.data?.data ?? [];
      if (items.length === 0) return { data: [] };
      return apiClient.getGrades(undefined, undefined);
    },
    enabled: !!selectedCourseId && !!gradeItemsQuery.data,
  });

  const categoriesQuery = useQuery({
    queryKey: ['grade-categories', selectedCourseId],
    queryFn: () => apiClient.getGradeCategories({ course_id: selectedCourseId }),
    enabled: !!selectedCourseId,
  });

  const workflowQuery = useQuery({
    queryKey: ['marking-workflow', selectedCourseId],
    queryFn: () => apiClient.getMarkingWorkflow({ course_id: selectedCourseId }),
    enabled: !!selectedCourseId && activeTab === 'workflow',
  });

  const releaseGrades = useMutation({
    mutationFn: () => apiClient.releaseGrades(
      releaseTarget === 'category' && releaseCategoryId
        ? { category_id: releaseCategoryId }
        : { course_id: selectedCourseId }
    ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grade-items', selectedCourseId] }),
  });

  const upsertGrade = useMutation({
    mutationFn: ({ item_id, user_id, grade }: { item_id: string; user_id: string; grade: number }) =>
      apiClient.upsertGrade({ item_id, user_id, grade }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grades', selectedCourseId] }),
  });

  const addCategory = useMutation({
    mutationFn: () => apiClient.createGradeCategory({
      course_id: selectedCourseId,
      name: newCat.name,
      aggregation_strategy: newCat.aggregation_strategy as import('@ako/shared').AggregationStrategy,
      drop_lowest: newCat.drop_lowest,
      weight: newCat.weight,
      parent_id: newCat.parent_id || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grade-categories', selectedCourseId] });
      setShowAddCategory(false);
      setNewCat({ name: '', aggregation_strategy: 'weighted_mean', drop_lowest: 0, weight: 100, parent_id: '' });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => apiClient.deleteGradeCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grade-categories', selectedCourseId] }),
  });

  const updateWorkflowState = useMutation({
    mutationFn: ({ id, state }: { id: string; state: MarkingWorkflowState }) =>
      apiClient.updateMarkingWorkflowState(id, { state }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marking-workflow', selectedCourseId] }),
  });

  const bulkImport = useMutation({
    mutationFn: () => {
      const rows = importText.trim().split('\n').slice(1).map(line => {
        const [item_name, username, grade, feedback] = line.split(',');
        return { item_name: item_name?.trim(), username: username?.trim(), grade: Number(grade?.trim()), feedback: feedback?.trim() };
      }).filter(r => r.item_name && r.username && !isNaN(r.grade));
      return apiClient.bulkImportGrades(rows);
    },
    onSuccess: (data) => {
      setImportResult(data);
      qc.invalidateQueries({ queryKey: ['grades', selectedCourseId] });
    },
  });

  const courses = (coursesQuery.data?.data ?? []) as Course[];
  const gradeItems = (gradeItemsQuery.data?.data ?? []) as GradeItem[];
  const categories = (categoriesQuery.data?.data ?? []) as GradeCategory[];
  const workflowStates = (workflowQuery.data?.data ?? []) as MarkingWorkflowStateRecord[];

  const handleGradeChange = (itemId: string, field: 'gradeValue' | 'targetUserId', value: string) => {
    setEditingGrades(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? {}), [field]: value },
    }));
  };


  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gradebook Management</h1>
          <p className="text-sm text-gray-500 mt-1">Quick grade entry, grade release, and marking workflow</p>
        </div>
        <Link href="/dashboard/admin" className="text-sm text-blue-600 hover:underline">← Admin</Link>
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
            <option key={c.course_id} value={c.course_id}>{c.course_code} – {c.title}</option>
          ))}
        </select>
      </div>

      {selectedCourseId && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200">
            {(['grades', 'categories', 'workflow'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize rounded-t-lg border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'workflow' ? 'Marking Workflow' : tab === 'categories' ? 'Grade Categories' : 'Quick Grade Entry'}
              </button>
            ))}
          </div>

          {/* Quick Grade Entry */}
          {activeTab === 'grades' && (
            <div className="space-y-4">
              {/* Grade Release Panel */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-3">Grade Release</h3>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-2 text-sm text-blue-800">
                    <input type="radio" checked={releaseTarget === 'course'} onChange={() => setReleaseTarget('course')} />
                    Release all hidden grades for course
                  </label>
                  <label className="flex items-center gap-2 text-sm text-blue-800">
                    <input type="radio" checked={releaseTarget === 'category'} onChange={() => setReleaseTarget('category')} />
                    Release by category:
                  </label>
                  {releaseTarget === 'category' && (
                    <select
                      value={releaseCategoryId}
                      onChange={e => setReleaseCategoryId(e.target.value)}
                      className="border border-blue-300 rounded-lg px-3 py-1.5 text-sm"
                    >
                      <option value="">Choose category…</option>
                      {categories.map(c => (
                        <option key={c.category_id} value={c.category_id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={() => releaseGrades.mutate()}
                    disabled={releaseGrades.isPending}
                    className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {releaseGrades.isPending ? 'Releasing…' : 'Release Grades'}
                  </button>
                  {releaseGrades.isSuccess && (
                    <span className="text-sm text-green-700">
                      ✓ Released {(releaseGrades.data as { released: number }).released} items
                    </span>
                  )}
                </div>
              </div>

              {/* Grade Items table */}
              {gradeItemsQuery.isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                </div>
              ) : gradeItems.length === 0 ? (
                <div className="text-center py-8 text-gray-400 bg-white border border-gray-100 rounded-lg">
                  No grade items for this course.
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Max</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Hidden</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Locked</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grade Entry</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {gradeItems.map((item: GradeItem) => {
                        const cat = categories.find(c => c.category_id === item.category_id);
                        return (
                          <tr key={item.item_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                            <td className="px-4 py-3 text-gray-500 capitalize">{item.source_type}</td>
                            <td className="px-4 py-3 text-gray-500">{item.max_grade}</td>
                            <td className="px-4 py-3 text-gray-500">{cat?.name ?? '—'}</td>
                            <td className="px-4 py-3">
                              {item.hidden ? (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700">Hidden</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Visible</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {item.locked ? (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-gray-200 text-gray-600">Locked</span>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  max={item.max_grade}
                                  disabled={item.locked}
                                  placeholder="—"
                                  value={editingGrades[item.item_id]?.['gradeValue'] ?? ''}
                                  onChange={e => handleGradeChange(item.item_id, 'gradeValue', e.target.value)}
                                  className="w-20 border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-50"
                                />
                                <input
                                  type="text"
                                  placeholder="user_id"
                                  value={editingGrades[item.item_id]?.['targetUserId'] ?? ''}
                                  onChange={e => handleGradeChange(item.item_id, 'targetUserId', e.target.value)}
                                  className="w-32 border border-gray-300 rounded px-2 py-1 text-sm"
                                />
                                <button
                                  onClick={() => {
                                    const grade = editingGrades[item.item_id]?.['gradeValue'];
                                    const userId = editingGrades[item.item_id]?.['targetUserId'];
                                    if (grade && userId) {
                                      upsertGrade.mutate({ item_id: item.item_id, user_id: userId, grade: Number(grade) });
                                    }
                                  }}
                                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                                >
                                  Save
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bulk Import */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Bulk Grade Import (CSV)</h3>
                <p className="text-xs text-gray-500">Format: <code className="bg-gray-100 px-1 rounded">item_name,username,grade,feedback</code> (one row per line, first line is header)</p>
                <textarea
                  rows={5}
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  placeholder={'item_name,username,grade,feedback\nMidterm Exam,john.smith,85,Good work\nMidterm Exam,jane.doe,92,Excellent'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => bulkImport.mutate()}
                    disabled={!importText.trim() || bulkImport.isPending}
                    className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {bulkImport.isPending ? 'Importing…' : 'Import Grades'}
                  </button>
                  {importResult && (
                    <span className="text-sm text-gray-700">
                      ✓ {importResult.imported} imported
                      {importResult.errors.length > 0 && <span className="text-red-600 ml-2">{importResult.errors.length} error(s)</span>}
                    </span>
                  )}
                </div>
                {importResult?.errors && importResult.errors.length > 0 && (
                  <ul className="text-xs text-red-600 space-y-0.5">
                    {importResult.errors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Grade Categories */}
          {activeTab === 'categories' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">Grade Categories</h2>
                <button
                  onClick={() => setShowAddCategory(!showAddCategory)}
                  className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
                >
                  + Add Category
                </button>
              </div>

              {showAddCategory && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Name</label>
                      <input
                        type="text"
                        value={newCat.name}
                        onChange={e => setNewCat(c => ({ ...c, name: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Aggregation</label>
                      <select
                        value={newCat.aggregation_strategy}
                        onChange={e => setNewCat(c => ({ ...c, aggregation_strategy: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        {['weighted_mean', 'simple_mean', 'sum', 'highest', 'lowest', 'mode'].map(s => (
                          <option key={s} value={s}>{s.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Weight (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={newCat.weight}
                        onChange={e => setNewCat(c => ({ ...c, weight: Number(e.target.value) }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Drop Lowest N</label>
                      <input
                        type="number"
                        min={0}
                        value={newCat.drop_lowest}
                        onChange={e => setNewCat(c => ({ ...c, drop_lowest: Number(e.target.value) }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Parent Category</label>
                      <select
                        value={newCat.parent_id}
                        onChange={e => setNewCat(c => ({ ...c, parent_id: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">None (top level)</option>
                        {categories.map(c => (
                          <option key={c.category_id} value={c.category_id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => addCategory.mutate()}
                      disabled={!newCat.name || addCategory.isPending}
                      className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {addCategory.isPending ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setShowAddCategory(false)} className="text-sm text-gray-500 px-3 py-2">Cancel</button>
                  </div>
                </div>
              )}

              {categoriesQuery.isLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>
              ) : categories.length === 0 ? (
                <div className="text-center py-8 text-gray-400 bg-white border border-gray-100 rounded-lg">
                  No grade categories yet.
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Name', 'Parent', 'Aggregation', 'Drop Lowest', 'Weight', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {categories.map((cat: GradeCategory) => {
                        const parent = categories.find(c => c.category_id === cat.parent_id);
                        return (
                          <tr key={cat.category_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {cat.parent_id && <span className="text-gray-400 mr-1">↳</span>}{cat.name}
                            </td>
                            <td className="px-4 py-3 text-gray-500">{parent?.name ?? '—'}</td>
                            <td className="px-4 py-3 text-gray-500 capitalize">{cat.aggregation_strategy.replace('_', ' ')}</td>
                            <td className="px-4 py-3 text-gray-500">{cat.drop_lowest}</td>
                            <td className="px-4 py-3 text-gray-500">{cat.weight}%</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => deleteCategory.mutate(cat.category_id)}
                                className="text-xs text-red-500 hover:text-red-700"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Marking Workflow */}
          {activeTab === 'workflow' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-800">Marking Workflow Queue</h2>
              {workflowQuery.isLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>
              ) : workflowStates.length === 0 ? (
                <div className="text-center py-8 text-gray-400 bg-white border border-gray-100 rounded-lg">
                  No marking workflow entries for this course.
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Learner', 'Item', 'State', 'Marker', 'Moderator', 'Notes', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {workflowStates.map((ws: MarkingWorkflowStateRecord & { item_name?: string; display_name?: string; email?: string; marker_name?: string; moderator_name?: string }) => (
                        <tr key={ws.mws_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{ws.display_name}</p>
                            <p className="text-xs text-gray-400">{ws.email}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{ws.item_name}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${workflowStateColours[ws.state]}`}>
                              {ws.state.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{ws.marker_name ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-500">{ws.moderator_name ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{ws.notes ?? '—'}</td>
                          <td className="px-4 py-3">
                            <select
                              value={ws.state}
                              onChange={e => updateWorkflowState.mutate({ id: ws.mws_id, state: e.target.value as MarkingWorkflowState })}
                              className="border border-gray-300 rounded px-2 py-1 text-xs"
                            >
                              <option value="unmarked">Unmarked</option>
                              <option value="in_progress">In Progress</option>
                              <option value="ready_for_release">Ready for Release</option>
                              <option value="released">Released</option>
                            </select>
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
  );
}
