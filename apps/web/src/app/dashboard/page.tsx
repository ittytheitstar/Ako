'use client';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => apiClient.getCourses(),
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient.getNotifications(),
  });

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.getMe(),
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {me?.display_name ?? 'Student'}
        </h1>
        <p className="text-gray-500 mt-1">Here&apos;s what&apos;s happening today</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Enrolled Courses', value: courses?.data?.length ?? 0, className: 'text-blue-600' },
          { label: 'Unread Notifications', value: notifications?.data?.filter(n => !n.read_at).length ?? 0, className: 'text-orange-600' },
          { label: 'Active Assignments', value: 0, className: 'text-green-600' },
          { label: 'Average Grade', value: '-', className: 'text-purple-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className={`text-3xl font-bold mt-1 ${stat.className}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Courses */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">My Courses</h2>
          <Link href="/dashboard/courses" className="text-sm text-blue-600 hover:text-blue-700">View all →</Link>
        </div>
        {coursesLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : courses?.data?.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No courses yet. Contact your instructor to enrol.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses?.data?.slice(0, 6).map((course) => (
              <Link
                key={course.course_id}
                href={`/dashboard/courses/${course.course_id}`}
                className="block p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">{course.course_code.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{course.title}</p>
                    <p className="text-sm text-gray-500">{course.course_code}</p>
                  </div>
                </div>
                {course.description && (
                  <p className="mt-2 text-sm text-gray-600 line-clamp-2">{course.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
