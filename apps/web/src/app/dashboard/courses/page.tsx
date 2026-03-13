'use client';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

type TabFilter = 'active' | 'draft' | 'all';

export default function CoursesPage() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabFilter>('all');
  const queryClient = useQueryClient();

  const { data: courses, isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => apiClient.getCourses(),
  });

  const { data: terms } = useQuery({
    queryKey: ['terms'],
    queryFn: () => apiClient.getTerms(),
  });

  const publishMutation = useMutation({
    mutationFn: (courseId: string) => apiClient.publishCourse(courseId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['courses'] }),
  });

  const termMap = new Map(terms?.data?.map(t => [t.term_id, t]) ?? []);

  const filtered = courses?.data?.filter(c => {
    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.course_code.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (tab === 'draft') return (c as { status?: string }).status === 'draft';
    if (tab === 'active') return (c as { status?: string }).status === 'published';
    return true;
  });

  const tabs: { id: TabFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'draft', label: 'Draft' },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
          <p className="text-gray-500 mt-1">Browse and access your enrolled courses</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search courses..."
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered?.map((course) => {
            const status = (course as { status?: string }).status;
            const termId = (course as { term_id?: string }).term_id;
            const term = termId ? termMap.get(termId) : undefined;
            return (
              <div key={course.course_id} className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all flex flex-col">
                <Link href={`/dashboard/courses/${course.course_id}`} className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-lg">{course.course_code.charAt(0)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{course.title}</p>
                      <p className="text-sm text-gray-500">{course.course_code}</p>
                    </div>
                  </div>
                  {course.description && (
                    <p className="text-sm text-gray-600 line-clamp-3 mb-3">{course.description}</p>
                  )}
                </Link>
                <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      course.visibility === 'public' ? 'bg-green-100 text-green-700' :
                      course.visibility === 'tenant' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {course.visibility}
                    </span>
                    {status && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {status}
                      </span>
                    )}
                    {term && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                        {term.code}
                      </span>
                    )}
                  </div>
                  {status === 'draft' && (
                    <button
                      onClick={(e) => { e.preventDefault(); publishMutation.mutate(course.course_id); }}
                      disabled={publishMutation.isPending}
                      className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      Publish
                    </button>
                  )}
                </div>
              </div>
            );
          })}
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
