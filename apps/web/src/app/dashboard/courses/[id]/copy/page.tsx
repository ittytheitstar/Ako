'use client';
import React, { use, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { CopyJob } from '@ako/shared';

export default function CourseCopyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [form, setForm] = useState({
    title: '',
    course_code: '',
    include_content: true,
    include_assessments: true,
    include_gradebook: true,
    include_forums: true,
    include_completion: true,
    include_calendar: true,
    include_cohorts: false,
  });
  const [job, setJob] = useState<CopyJob | null>(null);

  const courseQuery = useQuery({
    queryKey: ['course', id],
    queryFn: () => apiClient.getCourse(id),
  });

  const copyMutation = useMutation({
    mutationFn: () =>
      apiClient.copyCourse(id, {
        title: form.title,
        course_code: form.course_code,
        options: {
          include_content: form.include_content,
          include_assessments: form.include_assessments,
          include_gradebook: form.include_gradebook,
          include_forums: form.include_forums,
          include_completion: form.include_completion,
          include_calendar: form.include_calendar,
          include_cohorts: form.include_cohorts,
        },
      }),
    onSuccess: (data) => setJob(data),
  });

  const course = courseQuery.data;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.course_code.trim()) return;
    copyMutation.mutate();
  };

  if (courseQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (job) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <div className={`rounded-lg p-6 border ${
          job.status === 'complete'
            ? 'bg-green-50 border-green-200'
            : job.status === 'failed'
            ? 'bg-red-50 border-red-200'
            : 'bg-blue-50 border-blue-200'
        }`}>
          <h2 className="text-lg font-semibold mb-2">
            {job.status === 'complete' ? '✅ Course copied!' : job.status === 'failed' ? '❌ Copy failed' : '⏳ Copying…'}
          </h2>
          {job.status === 'complete' && (
            <>
              <p className="text-sm text-gray-700 mb-4">
                Your new course <strong>{job.target_course_title ?? form.title}</strong> is ready in{' '}
                <span className="font-medium">draft</span> status.
              </p>
              {job.target_course_id && (
                <a
                  href={`/dashboard/courses/${job.target_course_id}`}
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
                >
                  Open new course →
                </a>
              )}
            </>
          )}
          {job.status === 'failed' && (
            <p className="text-sm text-red-700">{job.error_message ?? 'An error occurred.'}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Copy course</h1>
        {course && (
          <p className="mt-1 text-sm text-gray-500">
            Copying from: <span className="font-medium">{course.title}</span> ({course.course_code})
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Target details */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="font-medium text-gray-900">New course details</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={course ? `Copy of ${course.title}` : 'New course title'}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course code *</label>
            <input
              type="text"
              required
              value={form.course_code}
              onChange={(e) => setForm({ ...form, course_code: e.target.value })}
              placeholder="e.g. ENG101-COPY"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Component selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-medium text-gray-900 mb-4">Select components to copy</h2>
          <div className="space-y-3">
            {[
              { key: 'include_content', label: 'Module content (page bodies, file references)' },
              { key: 'include_assessments', label: 'Assessment definitions (assignments, quizzes)' },
              { key: 'include_gradebook', label: 'Gradebook setup (categories, items, weights)' },
              { key: 'include_forums', label: 'Forum definitions (not posts)' },
              { key: 'include_completion', label: 'Completion criteria' },
              { key: 'include_calendar', label: 'Calendar events' },
              { key: 'include_cohorts', label: 'Enrolled cohorts / groups (optional)' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[key as keyof typeof form] as boolean}
                  onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Course structure (sections + modules) is always included. Learner submissions and grades
            are always excluded.
          </p>
        </div>

        {copyMutation.isError && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {(copyMutation.error as Error).message}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={copyMutation.isPending || !form.title.trim() || !form.course_code.trim()}
            className="px-5 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {copyMutation.isPending ? 'Copying…' : 'Copy course'}
          </button>
          <a
            href={`/dashboard/courses/${id}`}
            className="px-5 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
