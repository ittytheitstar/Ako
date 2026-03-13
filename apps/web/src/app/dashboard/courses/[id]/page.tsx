'use client';
import React, { useState, use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

type Tab = 'content' | 'forums' | 'announcements' | 'groups' | 'enrolments';

export default function CourseDetailPage({ params }: Props) {
  const { id } = use(params);
  const [tab, setTab] = useState<Tab>('content');
  const queryClient = useQueryClient();

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

  const { data: groups } = useQuery({
    queryKey: ['courseGroups', id],
    queryFn: () => apiClient.getCourseGroups(id),
    enabled: tab === 'groups',
  });

  const { data: groupings } = useQuery({
    queryKey: ['courseGroupings', id],
    queryFn: () => apiClient.getCourseGroupings(id),
    enabled: tab === 'groups',
  });

  const { data: enrolmentMethods } = useQuery({
    queryKey: ['enrolmentMethods', id],
    queryFn: () => apiClient.getEnrolmentMethods(id),
    enabled: tab === 'enrolments',
  });

  const { data: cohorts } = useQuery({
    queryKey: ['cohorts'],
    queryFn: () => apiClient.getCohorts(),
    enabled: tab === 'enrolments',
  });

  const publishMutation = useMutation({
    mutationFn: () => apiClient.publishCourse(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['course', id] }),
  });

  const deleteEnrolmentMethodMutation = useMutation({
    mutationFn: (methodId: string) => apiClient.deleteEnrolmentMethod(id, methodId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['enrolmentMethods', id] }),
  });

  const reconcileMutation = useMutation({
    mutationFn: () => apiClient.reconcileCourseEnrolments(id),
  });

  const [newMethodType, setNewMethodType] = useState<'manual' | 'cohort_sync'>('manual');
  const [newMethodCohort, setNewMethodCohort] = useState('');
  const [methodError, setMethodError] = useState('');

  const createMethodMutation = useMutation({
    mutationFn: () => apiClient.createEnrolmentMethod(id, {
      method_type: newMethodType,
      ...(newMethodType === 'cohort_sync' ? { cohort_id: newMethodCohort } : {}),
    } as Parameters<typeof apiClient.createEnrolmentMethod>[1]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrolmentMethods', id] });
      setNewMethodCohort('');
      setMethodError('');
    },
    onError: (e: Error) => setMethodError(e.message),
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

  const status = (course as { status?: string }).status;
  const cohortMap = new Map(cohorts?.data?.map(c => [c.cohort_id, c]) ?? []);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'content', label: 'Content', icon: '📚' },
    { id: 'forums', label: 'Discussions', icon: '💬' },
    { id: 'announcements', label: 'Announcements', icon: '📢' },
    { id: 'groups', label: 'Groups & Groupings', icon: '👥' },
    { id: 'enrolments', label: 'Enrolments', icon: '🎓' },
  ];

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Link href="/dashboard/courses" className="hover:text-blue-600">Courses</Link>
          <span>›</span>
          <span className="text-gray-900">{course.title}</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-2xl">{course.course_code.charAt(0)}</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
                {status && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {status}
                  </span>
                )}
              </div>
              <p className="text-gray-500">{course.course_code}</p>
              {course.description && <p className="text-gray-600 mt-2">{course.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {status === 'draft' && (
              <button
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {publishMutation.isPending ? 'Publishing…' : 'Publish Course'}
              </button>
            )}
            <Link
              href={`/dashboard/courses/${id}/builder`}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              Course Builder
            </Link>
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
                      {modulesBySection.get(section.section_id)?.data?.map((mod) => {
                        const availability = (mod as { availability?: { groupingName?: string } }).availability;
                        return (
                          <div key={mod.module_id} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors">
                            <span className="text-xl">{moduleIcons[mod.module_type] ?? '📌'}</span>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{mod.title}</p>
                              <p className="text-xs text-gray-500 capitalize">{mod.module_type}</p>
                              {availability?.groupingName && (
                                <p className="text-xs text-purple-600 mt-0.5">🔒 {availability.groupingName}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
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

      {tab === 'groups' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Groups</h3>
            {groups?.data?.length === 0 ? (
              <p className="text-sm text-gray-500">No groups yet</p>
            ) : (
              <div className="space-y-2">
                {groups?.data?.map(g => (
                  <div key={g.group_id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-900">{g.name}</span>
                    {(g as { cohort_id?: string }).cohort_id && (
                      <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">cohort-synced</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Groupings</h3>
            {groupings?.data?.length === 0 ? (
              <p className="text-sm text-gray-500">No groupings yet</p>
            ) : (
              <div className="space-y-3">
                {groupings?.data?.map(gp => (
                  <div key={gp.grouping_id} className="border border-gray-100 rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-900 mb-1">{gp.name}</p>
                    <div className="flex flex-wrap gap-1">
                      {gp.groups?.map(g => (
                        <span key={g.group_id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{g.name}</span>
                      ))}
                      {(!gp.groups || gp.groups.length === 0) && (
                        <span className="text-xs text-gray-400">No groups</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'enrolments' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Enrolment Methods</h3>
              <button
                onClick={() => reconcileMutation.mutate()}
                disabled={reconcileMutation.isPending}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50 transition-colors"
              >
                {reconcileMutation.isPending ? 'Syncing…' : '↻ Reconcile'}
              </button>
            </div>
            {reconcileMutation.isSuccess && (
              <div className="mb-3 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                Reconciled: +{reconcileMutation.data?.added} added, {reconcileMutation.data?.suspended} suspended
              </div>
            )}
            {enrolmentMethods?.data?.length === 0 ? (
              <p className="text-sm text-gray-500 mb-4">No enrolment methods configured</p>
            ) : (
              <div className="space-y-2 mb-4">
                {enrolmentMethods?.data?.map(m => (
                  <div key={m.method_id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <span className="text-sm font-medium text-gray-900 capitalize">{m.method_type}</span>
                      {m.cohort_id && (
                        <span className="ml-2 text-xs text-purple-600">
                          {cohortMap.get(m.cohort_id!)?.name ?? m.cohort_id}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => deleteEnrolmentMethodMutation.mutate(m.method_id)}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Add enrolment method</p>
              <div className="flex gap-2 flex-wrap">
                <select
                  value={newMethodType}
                  onChange={e => setNewMethodType(e.target.value as 'manual' | 'cohort_sync')}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="manual">Manual</option>
                  <option value="cohort_sync">Cohort Sync</option>
                </select>
                {newMethodType === 'cohort_sync' && (
                  <select
                    value={newMethodCohort}
                    onChange={e => setNewMethodCohort(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select cohort…</option>
                    {cohorts?.data?.map(c => (
                      <option key={c.cohort_id} value={c.cohort_id}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => createMethodMutation.mutate()}
                  disabled={createMethodMutation.isPending || (newMethodType === 'cohort_sync' && !newMethodCohort)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm transition-colors"
                >
                  Add
                </button>
              </div>
              {methodError && <p className="text-xs text-red-600 mt-1">{methodError}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
