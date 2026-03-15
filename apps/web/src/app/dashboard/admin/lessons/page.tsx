'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { LessonPage } from '@ako/shared';

export default function AdminLessonsPage() {
  const qc = useQueryClient();
  const [moduleId, setModuleId] = useState('');
  const [activeModuleId, setActiveModuleId] = useState('');

  const [maxAttempts, setMaxAttempts] = useState(3);
  const [passingGrade, setPassingGrade] = useState(70);
  const [showConfig, setShowConfig] = useState(false);

  const [showAddPage, setShowAddPage] = useState(false);
  const [editingPage, setEditingPage] = useState<LessonPage | null>(null);
  const [pageForm, setPageForm] = useState({
    page_type: 'content' as LessonPage['page_type'],
    title: '',
    body: '{}',
    question: '{}',
    position: 1,
  });

  const lessonQuery = useQuery({
    queryKey: ['admin-lesson', activeModuleId],
    queryFn: () => apiClient.getLesson(activeModuleId),
    enabled: !!activeModuleId,
  });

  const pagesQuery = useQuery({
    queryKey: ['admin-lesson-pages', activeModuleId],
    queryFn: () => apiClient.getLessonPages(activeModuleId),
    enabled: !!activeModuleId,
  });

  const upsertLesson = useMutation({
    mutationFn: () =>
      apiClient.upsertLesson(activeModuleId, {
        max_attempts: maxAttempts,
        passing_grade: passingGrade,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-lesson', activeModuleId] });
      setShowConfig(false);
    },
  });

  const createPage = useMutation({
    mutationFn: () => {
      let body: Record<string, unknown> = {};
      let question: Record<string, unknown> = {};
      try { body = JSON.parse(pageForm.body); } catch { /* ignore */ }
      try { question = JSON.parse(pageForm.question); } catch { /* ignore */ }
      return apiClient.createLessonPage(activeModuleId, {
        page_type: pageForm.page_type,
        title: pageForm.title,
        body,
        question,
        position: pageForm.position,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-lesson-pages', activeModuleId] });
      setShowAddPage(false);
      resetPageForm();
    },
  });

  const updatePage = useMutation({
    mutationFn: () => {
      let body: Record<string, unknown> = {};
      let question: Record<string, unknown> = {};
      try { body = JSON.parse(pageForm.body); } catch { /* ignore */ }
      try { question = JSON.parse(pageForm.question); } catch { /* ignore */ }
      return apiClient.updateLessonPage(activeModuleId, editingPage!.page_id, {
        page_type: pageForm.page_type,
        title: pageForm.title,
        body,
        question,
        position: pageForm.position,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-lesson-pages', activeModuleId] });
      setEditingPage(null);
    },
  });

  const deletePage = useMutation({
    mutationFn: (pageId: string) => apiClient.deleteLessonPage(activeModuleId, pageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-lesson-pages', activeModuleId] }),
  });

  const resetPageForm = () => {
    setPageForm({ page_type: 'content', title: '', body: '{}', question: '{}', position: 1 });
  };

  const startEditPage = (page: LessonPage) => {
    setEditingPage(page);
    setPageForm({
      page_type: page.page_type,
      title: page.title,
      body: JSON.stringify(page.body, null, 2),
      question: JSON.stringify(page.question, null, 2),
      position: page.position,
    });
    setShowAddPage(false);
  };

  const lesson = lessonQuery.data;
  const pages: LessonPage[] = pagesQuery.data?.data ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin — Lessons</h1>
        <p className="text-sm text-gray-500 mt-1">Manage lesson modules and pages</p>
      </div>

      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Module ID</label>
          <input
            type="text"
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
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

      {lessonQuery.isLoading && <p className="text-gray-500 text-sm">Loading…</p>}
      {lessonQuery.isError && <p className="text-red-600 text-sm">Lesson not found. It will be created on first save.</p>}

      {activeModuleId && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Lesson Configuration</h2>
              <button
                onClick={() => {
                  if (lesson) { setMaxAttempts(lesson.max_attempts); setPassingGrade(lesson.passing_grade); }
                  setShowConfig((v) => !v);
                }}
                className="text-sm text-blue-600 hover:underline"
              >
                {showConfig ? 'Cancel' : 'Edit'}
              </button>
            </div>
            {lesson && !showConfig && (
              <div className="flex gap-6 text-sm text-gray-600">
                <span>Max attempts: <strong>{lesson.max_attempts}</strong></span>
                <span>Passing grade: <strong>{lesson.passing_grade}%</strong></span>
              </div>
            )}
            {showConfig && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Max Attempts</label>
                    <input
                      type="number" min={1} value={maxAttempts}
                      onChange={(e) => setMaxAttempts(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Passing Grade (%)</label>
                    <input
                      type="number" min={0} max={100} value={passingGrade}
                      onChange={(e) => setPassingGrade(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <button
                  onClick={() => upsertLesson.mutate()}
                  disabled={upsertLesson.isPending}
                  className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {upsertLesson.isPending ? 'Saving…' : 'Save Configuration'}
                </button>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Pages ({pages.length})</h2>
              <button
                onClick={() => { setShowAddPage((v) => !v); setEditingPage(null); resetPageForm(); }}
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
              >
                + Add Page
              </button>
            </div>

            {(showAddPage || editingPage) && (
              <div className="p-5 bg-gray-50 border-b border-gray-200 space-y-3">
                <p className="text-sm font-medium text-gray-700">{editingPage ? 'Edit Page' : 'New Page'}</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Type</label>
                    <select
                      value={pageForm.page_type}
                      onChange={(e) => setPageForm((f) => ({ ...f, page_type: e.target.value as LessonPage['page_type'] }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="content">Content</option>
                      <option value="question">Question</option>
                      <option value="end_of_lesson">End of Lesson</option>
                      <option value="branch_table">Branch Table</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Title</label>
                    <input
                      type="text" value={pageForm.title}
                      onChange={(e) => setPageForm((f) => ({ ...f, title: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Position</label>
                    <input
                      type="number" min={1} value={pageForm.position}
                      onChange={(e) => setPageForm((f) => ({ ...f, position: Number(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Body (JSON)</label>
                    <textarea
                      rows={3} value={pageForm.body}
                      onChange={(e) => setPageForm((f) => ({ ...f, body: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Question (JSON)</label>
                    <textarea
                      rows={3} value={pageForm.question}
                      onChange={(e) => setPageForm((f) => ({ ...f, question: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => editingPage ? updatePage.mutate() : createPage.mutate()}
                    disabled={!pageForm.title || createPage.isPending || updatePage.isPending}
                    className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {(createPage.isPending || updatePage.isPending) ? 'Saving…' : 'Save Page'}
                  </button>
                  <button
                    onClick={() => { setShowAddPage(false); setEditingPage(null); }}
                    className="text-sm text-gray-500 px-3 py-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {pagesQuery.isLoading ? (
              <div className="p-5 text-gray-500 text-sm">Loading pages…</div>
            ) : pages.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No pages yet. Add one above.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['#', 'Type', 'Title', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pages.sort((a, b) => a.position - b.position).map((page) => (
                    <tr key={page.page_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 text-xs">{page.position}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {page.page_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-900">{page.title}</td>
                      <td className="px-4 py-3 flex gap-3">
                        <button onClick={() => startEditPage(page)} className="text-xs text-blue-600 hover:underline">Edit</button>
                        <button
                          onClick={() => deletePage.mutate(page.page_id)}
                          disabled={deletePage.isPending}
                          className="text-xs text-red-500 hover:underline disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </td>
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
