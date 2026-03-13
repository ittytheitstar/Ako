'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

export default function AdminArchivePage() {
  const queryClient = useQueryClient();
  const [archiving, setArchiving] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: coursesData, isLoading } = useQuery({
    queryKey: ['courses-all-admin'],
    queryFn: () => apiClient.getCourses(),
  });

  const archiveMutation = useMutation({
    mutationFn: ({ courseId, notes: n }: { courseId: string; notes: string }) =>
      apiClient.archiveCourse(courseId, { notes: n, trigger_type: 'manual' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses-all-admin'] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['courses-archived'] });
      setArchiving(null);
      setNotes('');
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const restoreMutation = useMutation({
    mutationFn: (courseId: string) => apiClient.restoreCourse(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses-all-admin'] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['courses-archived'] });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const courses = coursesData?.data ?? [];
  const activeCourses = courses.filter(c => c.status !== 'archived' && c.status !== 'deleted');
  const archivedCourses = courses.filter(c => c.status === 'archived' || c.archived_at);

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Link href="/dashboard" className="hover:text-blue-600">Dashboard</Link>
          <span>›</span>
          <span className="text-gray-900">Archive Scheduler</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Archive Scheduler</h1>
        <p className="text-gray-500 mt-1">
          Manage course lifecycle — archive completed courses and restore when needed.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Active Courses', value: activeCourses.length, className: 'text-blue-600' },
          { label: 'Archived Courses', value: archivedCourses.length, className: 'text-gray-600' },
          { label: 'Under Legal Hold', value: courses.filter(c => c.legal_hold).length, className: 'text-red-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className={`text-3xl font-bold mt-1 ${stat.className}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active courses */}
          {activeCourses.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Active Courses</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {activeCourses.map(course => (
                  <div key={course.course_id} className="px-6 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{course.title}</p>
                      <p className="text-sm text-gray-500">{course.course_code}</p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      course.status === 'published' ? 'bg-green-100 text-green-700' :
                      course.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {course.status ?? 'draft'}
                    </span>
                    <button
                      onClick={() => { setArchiving(course.course_id); setNotes(''); }}
                      className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      Archive
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Archived courses */}
          {archivedCourses.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Archived Courses</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {archivedCourses.map(course => (
                  <div key={course.course_id} className="px-6 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{course.title}</p>
                      <p className="text-sm text-gray-500">
                        {course.course_code}
                        {course.archived_at && ` · Archived ${new Date(course.archived_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    {course.legal_hold ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        🔒 Legal Hold
                      </span>
                    ) : (
                      <button
                        onClick={() => restoreMutation.mutate(course.course_id)}
                        disabled={restoreMutation.isPending}
                        className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Archive confirmation dialog */}
      {archiving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Archive Course?</h3>
            <p className="text-gray-600 mb-4">
              The course will become read-only. All submissions, grades and discussions are retained.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Reason for archiving…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setArchiving(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => archiveMutation.mutate({ courseId: archiving, notes })}
                disabled={archiveMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {archiveMutation.isPending ? 'Archiving…' : 'Archive Course'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
