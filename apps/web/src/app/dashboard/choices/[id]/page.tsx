'use client';
import React, { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { ChoiceOption } from '@ako/shared';

export default function ChoicePollPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const choiceQuery = useQuery({
    queryKey: ['choice', id],
    queryFn: () => apiClient.getChoice(id),
  });

  const resultsQuery = useQuery({
    queryKey: ['choice-results', id],
    queryFn: () => apiClient.getChoiceResults(id),
    enabled: showResults,
  });

  const submitAnswer = useMutation({
    mutationFn: () => apiClient.submitChoiceAnswer(id, { option_ids: selectedIds }),
    onSuccess: () => {
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ['choice', id] });
      if (choice?.show_results === 'after_answer') setShowResults(true);
    },
  });

  const choice = choiceQuery.data;
  const options: ChoiceOption[] = choice?.options ?? [];
  const totals = resultsQuery.data?.totals ?? {};
  const totalVotes = Object.values(totals).reduce((a, b) => a + b, 0);

  const toggleOption = (optionId: string) => {
    if (choice?.multiple_select) {
      setSelectedIds((prev) =>
        prev.includes(optionId) ? prev.filter((x) => x !== optionId) : [...prev, optionId]
      );
    } else {
      setSelectedIds([optionId]);
    }
  };

  if (choiceQuery.isLoading) return <div className="p-6 text-gray-500">Loading…</div>;
  if (choiceQuery.isError || !choice) return <div className="p-6 text-red-600">Failed to load poll.</div>;

  const isClosed = choice.close_at ? new Date(choice.close_at) < new Date() : false;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Poll</h1>
        {isClosed && (
          <span className="inline-block mt-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Closed</span>
        )}
        {choice.close_at && !isClosed && (
          <p className="text-sm text-gray-500 mt-1">Closes {new Date(choice.close_at).toLocaleString()}</p>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <p className="text-lg font-medium text-gray-900">{choice.question}</p>
        {choice.multiple_select && (
          <p className="text-xs text-gray-500">Select all that apply</p>
        )}

        <div className="space-y-2">
          {options.sort((a, b) => a.position - b.position).map((opt) => {
            const isSelected = selectedIds.includes(opt.option_id);
            const voteCount = totals[opt.option_id] ?? 0;
            const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;

            return (
              <div key={opt.option_id}>
                <label
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    submitted || isClosed
                      ? 'cursor-default bg-gray-50 border-gray-200'
                      : isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type={choice.multiple_select ? 'checkbox' : 'radio'}
                    checked={isSelected}
                    onChange={() => !submitted && !isClosed && toggleOption(opt.option_id)}
                    disabled={submitted || isClosed}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-800 flex-1">{opt.text}</span>
                  {showResults && (
                    <span className="text-xs text-gray-500 font-medium">{voteCount} ({pct}%)</span>
                  )}
                </label>
                {showResults && (
                  <div className="mt-1 mx-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 pt-2">
          {!submitted && !isClosed && (
            <button
              onClick={() => submitAnswer.mutate()}
              disabled={selectedIds.length === 0 || submitAnswer.isPending}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {submitAnswer.isPending ? 'Submitting…' : 'Submit'}
            </button>
          )}
          {submitted && <span className="text-green-600 text-sm font-medium self-center">✓ Response recorded</span>}
          {(submitted || isClosed) && choice.show_results !== 'never' && (
            <button
              onClick={() => setShowResults((v) => !v)}
              className="text-sm text-blue-600 hover:underline self-center"
            >
              {showResults ? 'Hide results' : 'Show results'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
