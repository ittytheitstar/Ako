'use client';
import React, { useState, use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

interface Props {
  params: Promise<{ id: string }>;
}

const moduleIcons: Record<string, string> = {
  page: '📄',
  file: '📎',
  forum: '💬',
  assignment: '📝',
  quiz: '❓',
  lti: '🔗',
  scorm: '📦',
};

type Tab = 'content' | 'forums' | 'announcements';

export default function CourseDetailPage({ params }: Props) {
  const { id } = use(params);
  const [tab, setTab] = useState<Tab>('content');

  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: () => apiClient.getCourse(id),
  });

  const { data: sections } = useQuery({
    queryKey: ['sections', id],
    queryFn: () => apiClient.getSections(id),
  });

  const { data: modules } = useQuery({
    queryKey: ['modules', id],
    queryFn: () => apiClient.getModules(id),
  });

  const { data: gradebook } = useQuery({
    queryKey: ['gradebook', id],
    queryFn: () => apiClient.getGradebook(id),
  });

  const { data: forums } = useQuery({
    queryKey: ['forums', id],
    queryFn: () => apiClient.getForums({ course_id: id }),
    enabled: tab === 'forums',
  });

  const { data: announcements } = useQuery({
    queryKey: ['announcements', id],
    queryFn: () => apiClient.getCourseAnnouncements(id),
    enabled: tab === 'announcements',
  });

  if (courseLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!course) return <div className="p-8 text-gray-500">Course not found</div>;

  type ModuleItem = NonNullable<typeof modules>['data'][number];
  type ModuleMap = { data: ModuleItem[] };

  const modulesBySection = new Map<string | undefined, ModuleMap>();
  modules?.data?.forEach(m => {
    const key = m.section_id ?? undefined;
    if (!modulesBySection.has(key)) modulesBySection.set(key, { data: [] });
    modulesBySection.get(key)!.data.push(m);
  });

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'content', label: 'Content', icon: '📚' },
    { id: 'forums', label: 'Discussions', icon: '💬' },
    { id: 'announcements', label: 'Announcements', icon: '📢' },
  ];

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Link href="/dashboard/courses" className="hover:text-blue-600">Courses</Link>
          <span>›</span>
          <span className="text-gray-900">{course.title}</span>
        </div>
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-2xl">{course.course_code.charAt(0)}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
            <p className="text-gray-500">{course.course_code}</p>
            {course.description && <p className="text-gray-600 mt-2">{course.description}</p>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'content' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {sections?.data?.length === 0 && modules?.data?.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
                This course has no content yet
              </div>
            ) : (
              <>
                {sections?.data?.map((section) => (
                  <div key={section.section_id} className="bg-white rounded-xl border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-100">
                      <h2 className="font-semibold text-gray-900">{section.title}</h2>
                      {section.summary && <p className="text-sm text-gray-500 mt-1">{section.summary}</p>}
                    </div>
                    <div className="divide-y divide-gray-50">
                      {modulesBySection.get(section.section_id)?.data?.map((mod) => (
                        <div key={mod.module_id} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors">
                          <span className="text-xl">{moduleIcons[mod.module_type] ?? '📌'}</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{mod.title}</p>
                            <p className="text-xs text-gray-500 capitalize">{mod.module_type}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {(modulesBySection.get(undefined)?.data?.length ?? 0) > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-100">
                      <h2 className="font-semibold text-gray-900">General</h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {modulesBySection.get(undefined)?.data?.map((mod) => (
                        <div key={mod.module_id} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50">
                          <span className="text-xl">{moduleIcons[mod.module_type] ?? '📌'}</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{mod.title}</p>
                            <p className="text-xs text-gray-500 capitalize">{mod.module_type}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Grade Summary</h3>
              {gradebook?.items?.length === 0 ? (
                <p className="text-sm text-gray-500">No grade items yet</p>
              ) : (
                <div className="space-y-2">
                  {gradebook?.items?.slice(0, 5).map((item) => {
                    const grade = gradebook.grades?.find(g => g.item_id === item.item_id);
                    return (
                      <div key={item.item_id} className="flex justify-between text-sm">
                        <span className="text-gray-600 truncate">{item.name}</span>
                        <span className="font-medium">
                          {grade?.grade !== undefined ? `${grade.grade}/${item.max_grade}` : '-'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <Link href="/dashboard/grades" className="mt-4 block text-sm text-blue-600 hover:text-blue-700">
                View full gradebook →
              </Link>
            </div>
          </div>
        </div>
      )}

      {tab === 'forums' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">Discussion forums for this course</p>
            <Link
              href="/dashboard/forums"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              All forums →
            </Link>
          </div>
          {forums?.data?.map(forum => (
            <Link
              key={forum.forum_id}
              href={`/dashboard/forums/${forum.forum_id}`}
              className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <span className="text-indigo-600 text-lg">💬</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">{forum.title}</p>
                <p className="text-xs text-gray-500 capitalize">{(forum as { forum_type?: string }).forum_type ?? 'general'} forum</p>
              </div>
            </Link>
          ))}
          {forums?.data?.length === 0 && (
            <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">
              No forums in this course
            </div>
          )}
        </div>
      )}

      {tab === 'announcements' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">Course announcements</p>
            <Link
              href={`/dashboard/courses/${id}/announcements`}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Manage →
            </Link>
          </div>
          {announcements?.data?.map(ann => (
            <div key={ann.announcement_id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-orange-600 text-xl">📢</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{ann.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ann.published_at ? new Date(ann.published_at).toLocaleString() : 'Unpublished'}
                  </p>
                  {ann.body && typeof ann.body === 'object' && 'text' in ann.body && (
                    <p className="text-sm text-gray-700 mt-2 line-clamp-3">
                      {String((ann.body as { text: string }).text)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {announcements?.data?.length === 0 && (
            <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">
              No announcements yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}
