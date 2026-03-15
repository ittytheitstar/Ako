'use client';
import React, { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { LessonPage, LessonAttempt } from '@ako/shared';

export default function LessonPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();

  const [attempt, setAttempt] = useState<LessonAttempt | null>(null);
  const [currentPage, setCurrentPage] = useState<LessonPage | null>(null);
  const [answer, setAnswer] = useState('');
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState<number | undefined>(undefined);
  const [lastCorrect, setLastCorrect] = useState<boolean | undefined>(undefined);

  const lessonQuery = useQuery({
    queryKey: ['lesson', id],
    queryFn: () => apiClient.getLesson(id),
  });

  const pagesQuery = useQuery({
    queryKey: ['lesson-pages', id],
    queryFn: () => apiClient.getLessonPages(id),
  });

  const startAttempt = useMutation({
    mutationFn: () => apiClient.startLessonAttempt(id),
    onSuccess: (data) => {
      setAttempt(data.attempt);
      setCurrentPage(data.page);
      setCompleted(false);
      setScore(undefined);
      setLastCorrect(undefined);
    },
  });

  const answerPage = useMutation({
    mutationFn: (ans: Record<string, unknown>) =>
      apiClient.answerLessonPage(id, attempt!.attempt_id, { answer: ans }),
    onSuccess: (data) => {
      setLastCorrect(data.correct);
      if (data.next_page) {
        setCurrentPage(data.next_page);
        setAnswer('');
      } else {
        finishAttempt.mutate();
      }
    },
  });

  const finishAttempt = useMutation({
    mutationFn: () => apiClient.finishLessonAttempt(id, attempt!.attempt_id),
    onSuccess: (data) => {
      setCompleted(true);
      setScore(data.score);
      setCurrentPage(null);
      qc.invalidateQueries({ queryKey: ['lesson', id] });
    },
  });

  const lesson = lessonQuery.data;
  const pages = pagesQuery.data?.data ?? [];

  if (lessonQuery.isLoading || pagesQuery.isLoading) {
    return <div className="p-6 text-gray-500">Loading…</div>;
  }
  if (lessonQuery.isError) {
    return <div className="p-6 text-red-600">Failed to load lesson.</div>;
  }

  const isQuestionPage = currentPage?.page_type === 'question';

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Lesson</h1>
        {lesson && (
          <p className="text-sm text-gray-500 mt-1">
            Max attempts: {lesson.max_attempts} · Passing grade: {lesson.passing_grade}%
          </p>
        )}
      </div>

      {!attempt && !completed && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <p className="text-gray-700">This lesson has <strong>{pages.length}</strong> page(s).</p>
          <button
            onClick={() => startAttempt.mutate()}
            disabled={startAttempt.isPending}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {startAttempt.isPending ? 'Starting…' : 'Start Lesson'}
          </button>
          {startAttempt.isError && (
            <p className="text-red-600 text-sm">Failed to start. You may have reached the attempt limit.</p>
          )}
        </div>
      )}

      {attempt && currentPage && !completed && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
              {currentPage.page_type.replace('_', ' ')}
            </span>
            <span className="text-xs text-gray-400">Position {currentPage.position}</span>
          </div>

          <h2 className="text-xl font-semibold text-gray-900">{currentPage.title}</h2>

          {Object.keys(currentPage.body).length > 0 && (
            <div className="prose prose-sm max-w-none text-gray-700 bg-gray-50 rounded-lg p-4 font-mono text-xs">
              {JSON.stringify(currentPage.body, null, 2)}
            </div>
          )}

          {lastCorrect !== undefined && (
            <div className={`text-sm font-medium px-3 py-2 rounded-lg ${lastCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {lastCorrect ? '✓ Correct!' : '✗ Incorrect'}
            </div>
          )}

          {isQuestionPage && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Your Answer</label>
              <textarea
                rows={3}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div className="flex gap-3">
            {isQuestionPage ? (
              <button
                onClick={() => answerPage.mutate({ text: answer })}
                disabled={!answer.trim() || answerPage.isPending}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {answerPage.isPending ? 'Submitting…' : 'Submit Answer'}
              </button>
            ) : (
              <button
                onClick={() => answerPage.mutate({})}
                disabled={answerPage.isPending || finishAttempt.isPending}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {answerPage.isPending || finishAttempt.isPending ? 'Loading…' : 'Next →'}
              </button>
            )}
          </div>
        </div>
      )}

      {completed && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4 text-center">
          <div className="text-4xl">🎓</div>
          <h2 className="text-xl font-semibold text-gray-900">Lesson Complete</h2>
          {score !== undefined && (
            <p className="text-gray-600">
              Your score: <span className="font-bold text-blue-600">{score}%</span>
              {lesson && (
                <span className={`ml-2 text-sm ${score >= lesson.passing_grade ? 'text-green-600' : 'text-red-600'}`}>
                  ({score >= lesson.passing_grade ? 'Passed' : 'Failed'})
                </span>
              )}
            </p>
          )}
          <button
            onClick={() => { setAttempt(null); setCompleted(false); setLastCorrect(undefined); }}
            className="text-sm text-blue-600 hover:underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
