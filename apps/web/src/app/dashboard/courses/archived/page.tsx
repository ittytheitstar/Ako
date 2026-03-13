'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

export default function ArchivedCoursesPage() {
  const queryClient = useQueryClient();
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['courses-archived'],
    queryFn: async () => {
      // Fetch all courses and filter archived ones
      const result = await apiClient.getCourses();
      return {
        ...result,
        data: result.data?.filter(c => c.status === 'archived' || c.archived_at),
      };
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (courseId: string) => apiClient.restoreCourse(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses-archived'] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setConfirmRestore(null);
    },
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Link href="/dashboard/courses" className="hover:text-blue-600">Courses</Link>
          <span>›</span>
          <span className="text-gray-900">Archived Courses</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Archived Courses</h1>
            <p className="text-gray-500 mt-1">
              Past courses available in read-only mode with retained submissions and grades.
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : data?.data?.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-4">📦</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No archived courses</h3>
          <p className="text-gray-500">Courses that have been archived will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data?.data?.map((course) => (
            <div
              key={course.course_id}
              className="bg-white rounded-xl border border-gray-200 p-6 flex items-start gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">{course.course_code.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{course.title}</h3>
                    <p className="text-sm text-gray-500">{course.course_code}</p>
                    {course.description && (
                      <p className="text-sm text-gray-600 mt-1">{course.description}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      📦 Archived
                    </span>
                    {course.legal_hold && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        🔒 Legal Hold
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  {course.archived_at && (
                    <span>Archived {new Date(course.archived_at).toLocaleDateString()}</span>
                  )}
                  {course.retention_until && (
                    <span>Retain until {new Date(course.retention_until).toLocaleDateString()}</span>
                  )}
                </div>
                <div className="flex gap-3 mt-4">
                  <Link
                    href={`/dashboard/courses/${course.course_id}`}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    View content →
                  </Link>
                  {!course.legal_hold && (
                    <button
                      onClick={() => setConfirmRestore(course.course_id)}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Restore
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Restore confirmation dialog */}
      {confirmRestore && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Restore Course?</h3>
            <p className="text-gray-600 mb-6">
              This course will be restored to published status and become accessible to enrolled learners again.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmRestore(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => restoreMutation.mutate(confirmRestore)}
                disabled={restoreMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {restoreMutation.isPending ? 'Restoring…' : 'Restore Course'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
