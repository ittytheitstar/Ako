'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { QuestionCategory, QuestionWithLatestVersion, QuestionType, QuestionStatus } from '@ako/shared';

const qtypeLabels: Record<QuestionType, string> = {
  mcq: 'Multiple Choice',
  multi: 'Multi-Select',
  short: 'Short Answer',
  essay: 'Essay',
  match: 'Matching',
  truefalse: 'True / False',
};

const statusBadge = (status: QuestionStatus) => {
  if (status === 'published') return 'bg-green-100 text-green-700';
  if (status === 'deprecated') return 'bg-red-100 text-red-700';
  return 'bg-yellow-100 text-yellow-700';
};

export default function QuestionBankPage() {
  const qc = useQueryClient();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [newCategoryParent, setNewCategoryParent] = useState('');
  const [newQ, setNewQ] = useState({
    qtype: 'mcq' as QuestionType,
    status: 'draft' as QuestionStatus,
    tags: '',
    promptText: '',
    options: '{}',
    answer_key: '{}',
    points: 1,
  });

  const categoriesQuery = useQuery({
    queryKey: ['question-categories'],
    queryFn: () => apiClient.getQuestionCategories(),
  });

  const questionsQuery = useQuery({
    queryKey: ['questions', selectedCategoryId, filterStatus],
    queryFn: () => apiClient.getQuestions({
      category_id: selectedCategoryId || undefined,
      status: filterStatus || undefined,
    }),
  });

  const addCategory = useMutation({
    mutationFn: () => apiClient.createQuestionCategory({
      name: newCategoryName,
      description: newCategoryDesc || undefined,
      parent_id: newCategoryParent || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['question-categories'] });
      setNewCategoryName('');
      setNewCategoryDesc('');
      setNewCategoryParent('');
      setShowAddCategory(false);
    },
  });

  const addQuestion = useMutation({
    mutationFn: () => {
      let options: Record<string, unknown> = {};
      let answer_key: Record<string, unknown> = {};
      try { options = JSON.parse(newQ.options); } catch { /* ignore */ }
      try { answer_key = JSON.parse(newQ.answer_key); } catch { /* ignore */ }
      return apiClient.createQuestion({
        category_id: selectedCategoryId || undefined,
        qtype: newQ.qtype,
        status: newQ.status,
        tags: newQ.tags.split(',').map(t => t.trim()).filter(Boolean),
        prompt: { text: newQ.promptText },
        options,
        answer_key,
        points: newQ.points,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions'] });
      setShowAddQuestion(false);
      setNewQ({ qtype: 'mcq', status: 'draft', tags: '', promptText: '', options: '{}', answer_key: '{}', points: 1 });
    },
  });

  const deprecateQ = useMutation({
    mutationFn: (id: string) => apiClient.deprecateQuestion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['questions'] }),
  });

  const publishQ = useMutation({
    mutationFn: (id: string) => apiClient.updateQuestion(id, { status: 'published' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['questions'] }),
  });

  const categories = (categoriesQuery.data?.data ?? []) as QuestionCategory[];
  const questions = (questionsQuery.data?.data ?? []) as QuestionWithLatestVersion[];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Question Bank</h1>
          <p className="text-sm text-gray-500 mt-1">Manage reusable questions across courses</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddCategory(!showAddCategory)}
            className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200"
          >
            + Category
          </button>
          <button
            onClick={() => setShowAddQuestion(!showAddQuestion)}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
          >
            + Question
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {/* Category sidebar */}
        <div className="col-span-1 space-y-1">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Categories</p>
          <button
            onClick={() => setSelectedCategoryId('')}
            className={`w-full text-left text-sm px-3 py-2 rounded-lg ${!selectedCategoryId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            All Questions
          </button>
          {categories.map((cat: QuestionCategory) => (
            <button
              key={cat.category_id}
              onClick={() => setSelectedCategoryId(cat.category_id)}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg ${selectedCategoryId === cat.category_id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {cat.parent_id && <span className="text-gray-400 mr-1">↳</span>}
              {cat.name}
            </button>
          ))}
        </div>

        {/* Main content */}
        <div className="col-span-3 space-y-4">
          {/* Add Category Form */}
          {showAddCategory && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">New Category</p>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Category name"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newCategoryDesc}
                  onChange={e => setNewCategoryDesc(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Parent Category (optional)</label>
                <select
                  value={newCategoryParent}
                  onChange={e => setNewCategoryParent(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                >
                  <option value="">None (top level)</option>
                  {categories.map((cat: QuestionCategory) => (
                    <option key={cat.category_id} value={cat.category_id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => addCategory.mutate()}
                  disabled={!newCategoryName || addCategory.isPending}
                  className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {addCategory.isPending ? 'Saving…' : 'Save Category'}
                </button>
                <button onClick={() => setShowAddCategory(false)} className="text-sm text-gray-500 px-3 py-2">Cancel</button>
              </div>
            </div>
          )}

          {/* Add Question Form */}
          {showAddQuestion && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">New Question</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Type</label>
                  <select
                    value={newQ.qtype}
                    onChange={e => setNewQ(q => ({ ...q, qtype: e.target.value as QuestionType }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {(Object.entries(qtypeLabels) as [QuestionType, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Status</label>
                  <select
                    value={newQ.status}
                    onChange={e => setNewQ(q => ({ ...q, status: e.target.value as QuestionStatus }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Points</label>
                  <input
                    type="number"
                    min={1}
                    value={newQ.points}
                    onChange={e => setNewQ(q => ({ ...q, points: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Question Prompt</label>
                <textarea
                  rows={2}
                  placeholder="Enter the question text"
                  value={newQ.promptText}
                  onChange={e => setNewQ(q => ({ ...q, promptText: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Options (JSON)</label>
                  <textarea
                    rows={3}
                    value={newQ.options}
                    onChange={e => setNewQ(q => ({ ...q, options: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Answer Key (JSON)</label>
                  <textarea
                    rows={3}
                    value={newQ.answer_key}
                    onChange={e => setNewQ(q => ({ ...q, answer_key: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  placeholder="algebra, calculus, easy"
                  value={newQ.tags}
                  onChange={e => setNewQ(q => ({ ...q, tags: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => addQuestion.mutate()}
                  disabled={!newQ.promptText || addQuestion.isPending}
                  className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {addQuestion.isPending ? 'Saving…' : 'Save Question'}
                </button>
                <button onClick={() => setShowAddQuestion(false)} className="text-sm text-gray-500 px-3 py-2">Cancel</button>
              </div>
            </div>
          )}

          {/* Filter bar */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">Status:</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="deprecated">Deprecated</option>
            </select>
            <span className="text-xs text-gray-400 ml-auto">{questions.length} question{questions.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Questions table */}
          {questionsQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white border border-gray-100 rounded-lg">
              No questions found. Add one above.
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Prompt', 'Type', 'Status', 'Points', 'Tags', 'Version', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {questions.map((q: QuestionWithLatestVersion) => {
                    const promptText = (q.latest_version?.prompt as { text?: string })?.text ?? '—';
                    return (
                      <tr key={q.question_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 max-w-xs truncate" title={promptText}>{promptText}</td>
                        <td className="px-4 py-3 text-gray-500">{qtypeLabels[q.qtype]}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(q.status)}`}>
                            {q.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{q.latest_version?.points ?? '—'}</td>
                        <td className="px-4 py-3">
                          {q.tags.map(tag => (
                            <span key={tag} className="mr-1 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{tag}</span>
                          ))}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">v{q.latest_version?.version_num ?? 1}</td>
                        <td className="px-4 py-3 flex items-center gap-2">
                          {q.status === 'draft' && (
                            <button
                              onClick={() => publishQ.mutate(q.question_id)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Publish
                            </button>
                          )}
                          {q.status !== 'deprecated' && (
                            <button
                              onClick={() => deprecateQ.mutate(q.question_id)}
                              className="text-xs text-red-500 hover:underline"
                            >
                              Deprecate
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
