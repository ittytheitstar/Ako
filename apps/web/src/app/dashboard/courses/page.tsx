'use client';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

export default function CoursesPage() {
  const [search, setSearch] = useState('');
  const { data: courses, isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => apiClient.getCourses(),
  });

  const filtered = courses?.data?.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.course_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
          <p className="text-gray-500 mt-1">Browse and access your enrolled courses</p>
        </div>
      </div>

      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search courses..."
          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered?.map((course) => (
            <Link
              key={course.course_id}
              href={`/dashboard/courses/${course.course_id}`}
              className="block bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">{course.course_code.charAt(0)}</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{course.title}</p>
                  <p className="text-sm text-gray-500">{course.course_code}</p>
                </div>
              </div>
              {course.description && (
                <p className="text-sm text-gray-600 line-clamp-3">{course.description}</p>
              )}
              <div className="mt-4 flex items-center justify-between">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  course.visibility === 'public' ? 'bg-green-100 text-green-700' :
                  course.visibility === 'tenant' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {course.visibility}
                </span>
                <span className="text-xs text-blue-600 font-medium">View course →</span>
              </div>
            </Link>
          ))}
          {filtered?.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-500">
              No courses found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
