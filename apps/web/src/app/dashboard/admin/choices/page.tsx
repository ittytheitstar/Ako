'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { ChoiceOption } from '@ako/shared';

export default function AdminChoicesPage() {
  const qc = useQueryClient();
  const [moduleId, setModuleId] = useState('');
  const [activeModuleId, setActiveModuleId] = useState('');

  const [showConfig, setShowConfig] = useState(false);
  const [question, setQuestion] = useState('');
  const [closeAt, setCloseAt] = useState('');
  const [showResults, setShowResults] = useState<'after_answer' | 'after_close' | 'never'>('after_answer');
  const [multipleSelect, setMultipleSelect] = useState(false);
  const [anonymous, setAnonymous] = useState(false);

  const [newOptionText, setNewOptionText] = useState('');
  const [showResults2, setShowResults2] = useState(false);

  const choiceQuery = useQuery({
    queryKey: ['admin-choice', activeModuleId],
    queryFn: () => apiClient.getChoice(activeModuleId),
    enabled: !!activeModuleId,
  });

  const resultsQuery = useQuery({
    queryKey: ['admin-choice-results', activeModuleId],
    queryFn: () => apiClient.getChoiceResults(activeModuleId),
    enabled: showResults2 && !!activeModuleId,
  });

  const upsertChoice = useMutation({
    mutationFn: () =>
      apiClient.upsertChoice(activeModuleId, {
        question,
        close_at: closeAt || undefined,
        show_results: showResults,
        multiple_select: multipleSelect,
        anonymous,
        options: options.map((o) => ({ text: o.text })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-choice', activeModuleId] });
      setShowConfig(false);
    },
  });

  const choice = choiceQuery.data;
  const options: ChoiceOption[] = choice?.options ?? [];
  const totals = resultsQuery.data?.totals ?? {};
  const totalVotes = Object.values(totals).reduce((a, b) => a + b, 0);

  const openConfig = () => {
    if (choice) {
      setQuestion(choice.question);
      setCloseAt(choice.close_at ? new Date(choice.close_at).toISOString().slice(0, 16) : '');
      setShowResults(choice.show_results);
      setMultipleSelect(choice.multiple_select);
      setAnonymous(choice.anonymous);
    }
    setShowConfig(true);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin — Choices / Polls</h1>
        <p className="text-sm text-gray-500 mt-1">Configure polls and view results</p>
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
          onClick={() => { setActiveModuleId(moduleId); setShowResults2(false); }}
          disabled={!moduleId}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          Load
        </button>
      </div>

      {choiceQuery.isLoading && <p className="text-gray-500 text-sm">Loading…</p>}

      {activeModuleId && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Poll Configuration</h2>
              <button onClick={openConfig} className="text-sm text-blue-600 hover:underline">
                {choice ? 'Edit' : 'Create'}
              </button>
            </div>

            {choice && !showConfig && (
              <div className="space-y-2">
                <p className="text-gray-800 font-medium">{choice.question}</p>
                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  <span>Results: {choice.show_results.replace('_', ' ')}</span>
                  <span>Multiple select: {choice.multiple_select ? 'Yes' : 'No'}</span>
                  <span>Anonymous: {choice.anonymous ? 'Yes' : 'No'}</span>
                  {choice.close_at && <span>Closes: {new Date(choice.close_at).toLocaleString()}</span>}
                </div>
              </div>
            )}

            {showConfig && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Question</label>
                  <input
                    type="text" value={question} onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Poll question…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Close At (optional)</label>
                    <input
                      type="datetime-local" value={closeAt} onChange={(e) => setCloseAt(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Show Results</label>
                    <select
                      value={showResults}
                      onChange={(e) => setShowResults(e.target.value as typeof showResults)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="after_answer">After Answer</option>
                      <option value="after_close">After Close</option>
                      <option value="never">Never</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={multipleSelect} onChange={(e) => setMultipleSelect(e.target.checked)} className="accent-blue-600" />
                    Multiple Select
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="accent-blue-600" />
                    Anonymous
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => upsertChoice.mutate()}
                    disabled={!question || upsertChoice.isPending}
                    className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {upsertChoice.isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setShowConfig(false)} className="text-sm text-gray-500 px-3 py-2">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {choice && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Options ({options.length})</h2>
              </div>
              {options.length === 0 ? (
                <p className="text-sm text-gray-400">No options configured. Use the API or backend to add options.</p>
              ) : (
                <div className="space-y-2">
                  {options.sort((a, b) => a.position - b.position).map((opt) => {
                    const voteCount = totals[opt.option_id] ?? 0;
                    const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                    return (
                      <div key={opt.option_id} className="flex items-center gap-4 p-3 border border-gray-100 rounded-lg">
                        <span className="flex-1 text-sm text-gray-800">{opt.text}</span>
                        {showResults2 && (
                          <span className="text-xs text-gray-500 font-medium">{voteCount} votes ({pct}%)</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {choice && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Results</h2>
                <button
                  onClick={() => setShowResults2((v) => !v)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {showResults2 ? 'Hide' : 'Show Results'}
                </button>
              </div>
              {showResults2 && (
                resultsQuery.isLoading ? (
                  <p className="text-gray-500 text-sm">Loading…</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Total votes: <strong>{totalVotes}</strong></p>
                    {options.map((opt) => {
                      const votes = totals[opt.option_id] ?? 0;
                      const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                      return (
                        <div key={opt.option_id} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-700">{opt.text}</span>
                            <span className="text-gray-500 font-medium">{votes} ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
