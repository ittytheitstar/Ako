'use client';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

export default function EnrolmentsPage() {
  const queryClient = useQueryClient();

  const { data: courses, isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => apiClient.getCourses(),
  });

  const { data: cohorts } = useQuery({
    queryKey: ['cohorts'],
    queryFn: () => apiClient.getCohorts(),
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Enrolments</h1>
        <p className="text-gray-500 mt-1">Manage course enrolment methods and sync</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-4">
          {courses?.data?.map(course => (
            <CourseEnrolmentCard
              key={course.course_id}
              course={course}
              cohorts={cohorts?.data ?? []}
              queryClient={queryClient}
            />
          ))}
          {courses?.data?.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
              No courses found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CourseEnrolmentCardProps {
  course: { course_id: string; title: string; course_code: string; status?: string };
  cohorts: { cohort_id: string; code: string; name: string }[];
  queryClient: ReturnType<typeof useQueryClient>;
}

function CourseEnrolmentCard({ course, cohorts }: CourseEnrolmentCardProps) {
  const queryClient = useQueryClient();
  const [newMethodType, setNewMethodType] = useState<'manual' | 'cohort_sync'>('manual');
  const [newMethodCohort, setNewMethodCohort] = useState('');
  const [addError, setAddError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const { data: methods } = useQuery({
    queryKey: ['enrolmentMethods', course.course_id],
    queryFn: () => apiClient.getEnrolmentMethods(course.course_id),
    enabled: expanded,
  });

  const cohortMap = new Map(cohorts.map(c => [c.cohort_id, c]));

  const reconcileMutation = useMutation({
    mutationFn: () => apiClient.reconcileCourseEnrolments(course.course_id),
  });

  const createMethodMutation = useMutation({
    mutationFn: () => apiClient.createEnrolmentMethod(course.course_id, {
      method_type: newMethodType,
      ...(newMethodType === 'cohort_sync' ? { cohort_id: newMethodCohort } : {}),
    } as Parameters<typeof apiClient.createEnrolmentMethod>[1]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrolmentMethods', course.course_id] });
      setNewMethodCohort('');
      setAddError('');
    },
    onError: (e: Error) => setAddError(e.message),
  });

  const deleteMethodMutation = useMutation({
    mutationFn: (methodId: string) => apiClient.deleteEnrolmentMethod(course.course_id, methodId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['enrolmentMethods', course.course_id] }),
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div
        className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">{course.course_code.charAt(0)}</span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{course.title}</p>
            <p className="text-sm text-gray-500">{course.course_code}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {(course as { status?: string }).status && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              (course as { status?: string }).status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {(course as { status?: string }).status}
            </span>
          )}
          <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="px-6 pb-6 border-t border-gray-100">
          <div className="flex items-center justify-between mt-4 mb-3">
            <p className="text-sm font-medium text-gray-700">Enrolment Methods</p>
            <div className="flex items-center gap-2">
              {reconcileMutation.isSuccess && (
                <span className="text-xs text-green-600">
                  ✓ +{reconcileMutation.data?.added} added
                </span>
              )}
              <button
                onClick={() => reconcileMutation.mutate()}
                disabled={reconcileMutation.isPending}
                className="px-3 py-1 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-xs disabled:opacity-50 transition-colors"
              >
                {reconcileMutation.isPending ? 'Syncing…' : '↻ Reconcile'}
              </button>
              <Link
                href={`/dashboard/courses/${course.course_id}`}
                className="px-3 py-1 text-blue-600 hover:text-blue-700 text-xs font-medium"
              >
                View course →
              </Link>
            </div>
          </div>

          {methods?.data?.length === 0 ? (
            <p className="text-sm text-gray-400 mb-3">No enrolment methods configured</p>
          ) : (
            <div className="divide-y divide-gray-100 mb-3">
              {methods?.data?.map(m => (
                <div key={m.method_id} className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm font-medium text-gray-900 capitalize">{m.method_type}</span>
                    {m.cohort_id && (
                      <span className="ml-2 text-xs text-purple-600">
                        {cohortMap.get(m.cohort_id!)?.name ?? m.cohort_id}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteMethodMutation.mutate(m.method_id)}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 flex-wrap items-center border-t border-gray-100 pt-3">
            <select
              value={newMethodType}
              onChange={e => setNewMethodType(e.target.value as 'manual' | 'cohort_sync')}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="manual">Manual</option>
              <option value="cohort_sync">Cohort Sync</option>
            </select>
            {newMethodType === 'cohort_sync' && (
              <select
                value={newMethodCohort}
                onChange={e => setNewMethodCohort(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select cohort…</option>
                {cohorts.map(c => (
                  <option key={c.cohort_id} value={c.cohort_id}>{c.name} ({c.code})</option>
                ))}
              </select>
            )}
            <button
              onClick={() => createMethodMutation.mutate()}
              disabled={createMethodMutation.isPending || (newMethodType === 'cohort_sync' && !newMethodCohort)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm transition-colors"
            >
              {createMethodMutation.isPending ? 'Adding…' : 'Add Method'}
            </button>
          </div>
          {addError && <p className="text-xs text-red-600 mt-1">{addError}</p>}
        </div>
      )}
    </div>
  );
}
