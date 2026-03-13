'use client';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

interface Props {
  params: Promise<{ id: string }>;
}

const MODULE_TYPES = ['page', 'file', 'forum', 'assignment', 'quiz', 'lti', 'scorm'] as const;
type ModuleType = typeof MODULE_TYPES[number];

const moduleIcons: Record<string, string> = {
  page: '📄', file: '📎', forum: '💬', assignment: '📝', quiz: '❓', lti: '🔗', scorm: '📦',
};

export default function CourseBuilderPage({ params }: Props) {
  const { id: courseId } = React.use(params);
  const queryClient = useQueryClient();

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => apiClient.getCourse(courseId),
  });

  const { data: sections, isLoading: sectionsLoading } = useQuery({
    queryKey: ['sections', courseId],
    queryFn: () => apiClient.getSections(courseId),
  });

  const { data: modules } = useQuery({
    queryKey: ['modules', courseId],
    queryFn: () => apiClient.getModules(courseId),
  });

  const { data: groups } = useQuery({
    queryKey: ['courseGroups', courseId],
    queryFn: () => apiClient.getCourseGroups(courseId),
  });

  const { data: groupings } = useQuery({
    queryKey: ['courseGroupings', courseId],
    queryFn: () => apiClient.getCourseGroupings(courseId),
  });

  // ── Section form ─────────────────────────────────────────────────────────
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionError, setSectionError] = useState('');

  const createSectionMutation = useMutation({
    mutationFn: () => apiClient.createSection(courseId, { title: sectionTitle }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections', courseId] });
      setSectionTitle('');
      setSectionError('');
    },
    onError: (e: Error) => setSectionError(e.message),
  });

  // ── Module form ───────────────────────────────────────────────────────────
  const [modSectionId, setModSectionId] = useState('');
  const [modTitle, setModTitle] = useState('');
  const [modType, setModType] = useState<ModuleType>('page');
  const [modError, setModError] = useState('');

  const createModuleMutation = useMutation({
    mutationFn: () => apiClient.createModule(courseId, {
      title: modTitle,
      module_type: modType,
      section_id: modSectionId || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modules', courseId] });
      setModTitle('');
      setModError('');
    },
    onError: (e: Error) => setModError(e.message),
  });

  // ── Module visibility ─────────────────────────────────────────────────────
  const toggleVisibilityMutation = useMutation({
    mutationFn: ({ moduleId, visible }: { moduleId: string; visible: boolean }) =>
      visible ? apiClient.showModule(courseId, moduleId) : apiClient.hideModule(courseId, moduleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['modules', courseId] }),
  });

  // ── Move module ───────────────────────────────────────────────────────────
  const moveModuleMutation = useMutation({
    mutationFn: ({ moduleId, position }: { moduleId: string; position: number }) =>
      apiClient.moveModule(courseId, moduleId, { position }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['modules', courseId] }),
  });

  // ── Groupings form ────────────────────────────────────────────────────────
  const [groupingName, setGroupingName] = useState('');
  const [groupingError, setGroupingError] = useState('');
  const [selectedGroupingId, setSelectedGroupingId] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [addGroupsError, setAddGroupsError] = useState('');

  const createGroupingMutation = useMutation({
    mutationFn: () => apiClient.createCourseGrouping(courseId, { name: groupingName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseGroupings', courseId] });
      setGroupingName('');
      setGroupingError('');
    },
    onError: (e: Error) => setGroupingError(e.message),
  });

  const addGroupsToGroupingMutation = useMutation({
    mutationFn: () => apiClient.addGroupsToGrouping(courseId, selectedGroupingId, selectedGroupIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseGroupings', courseId] });
      setSelectedGroupIds([]);
      setAddGroupsError('');
    },
    onError: (e: Error) => setAddGroupsError(e.message),
  });

  const deleteGroupingMutation = useMutation({
    mutationFn: (groupingId: string) => apiClient.deleteCourseGrouping(courseId, groupingId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['courseGroupings', courseId] }),
  });

  // ── Enrolment methods ────────────────────────────────────────────────────
  const { data: enrolmentMethods } = useQuery({
    queryKey: ['enrolmentMethods', courseId],
    queryFn: () => apiClient.getEnrolmentMethods(courseId),
  });

  const { data: cohorts } = useQuery({
    queryKey: ['cohorts'],
    queryFn: () => apiClient.getCohorts(),
  });

  const [newMethodType, setNewMethodType] = useState<'manual' | 'cohort_sync'>('manual');
  const [newMethodCohort, setNewMethodCohort] = useState('');
  const [methodError, setMethodError] = useState('');

  const createMethodMutation = useMutation({
    mutationFn: () => apiClient.createEnrolmentMethod(courseId, {
      method_type: newMethodType,
      ...(newMethodType === 'cohort_sync' ? { cohort_id: newMethodCohort } : {}),
    } as Parameters<typeof apiClient.createEnrolmentMethod>[1]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrolmentMethods', courseId] });
      setNewMethodCohort('');
      setMethodError('');
    },
    onError: (e: Error) => setMethodError(e.message),
  });

  const deleteMethodMutation = useMutation({
    mutationFn: (methodId: string) => apiClient.deleteEnrolmentMethod(courseId, methodId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['enrolmentMethods', courseId] }),
  });

  const reconcileMutation = useMutation({
    mutationFn: () => apiClient.reconcileCourseEnrolments(courseId),
  });

  // ── Build modules-by-section map ─────────────────────────────────────────
  type CourseModuleData = NonNullable<typeof modules>['data'][number];
  const modulesBySection = new Map<string | undefined, CourseModuleData[]>();
  modules?.data?.forEach(m => {
    const key = m.section_id ?? undefined;
    if (!modulesBySection.has(key)) modulesBySection.set(key, []);
    modulesBySection.get(key)!.push(m);
  });

  const cohortMap = new Map(cohorts?.data?.map(c => [c.cohort_id, c]) ?? []);

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/dashboard/courses" className="hover:text-blue-600">Courses</Link>
        <span>›</span>
        <Link href={`/dashboard/courses/${courseId}`} className="hover:text-blue-600">{course?.title ?? courseId}</Link>
        <span>›</span>
        <span className="text-gray-900">Builder</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Course Builder</h1>
          <p className="text-gray-500 mt-1">{course?.course_code}</p>
        </div>
        <Link
          href={`/dashboard/courses/${courseId}`}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
        >
          ← Back to Course
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Content structure */}
        <div className="lg:col-span-2 space-y-6">
          {/* Add section */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Add Section</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={sectionTitle}
                onChange={e => setSectionTitle(e.target.value)}
                placeholder="Section title…"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => { if (e.key === 'Enter' && sectionTitle.trim()) createSectionMutation.mutate(); }}
              />
              <button
                onClick={() => createSectionMutation.mutate()}
                disabled={createSectionMutation.isPending || !sectionTitle.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm transition-colors"
              >
                {createSectionMutation.isPending ? 'Adding…' : 'Add'}
              </button>
            </div>
            {sectionError && <p className="text-xs text-red-600 mt-1">{sectionError}</p>}
          </div>

          {/* Add module */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Add Module</h3>
            <div className="flex gap-2 flex-wrap">
              <select
                value={modSectionId}
                onChange={e => setModSectionId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">General (no section)</option>
                {sections?.data?.map(s => (
                  <option key={s.section_id} value={s.section_id}>{s.title}</option>
                ))}
              </select>
              <select
                value={modType}
                onChange={e => setModType(e.target.value as ModuleType)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MODULE_TYPES.map(t => (
                  <option key={t} value={t}>{moduleIcons[t]} {t}</option>
                ))}
              </select>
              <input
                type="text"
                value={modTitle}
                onChange={e => setModTitle(e.target.value)}
                placeholder="Module title…"
                className="flex-1 min-w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => { if (e.key === 'Enter' && modTitle.trim()) createModuleMutation.mutate(); }}
              />
              <button
                onClick={() => createModuleMutation.mutate()}
                disabled={createModuleMutation.isPending || !modTitle.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm transition-colors"
              >
                {createModuleMutation.isPending ? 'Adding…' : 'Add'}
              </button>
            </div>
            {modError && <p className="text-xs text-red-600 mt-1">{modError}</p>}
          </div>

          {/* Section / module tree */}
          {sectionsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : (
            <div className="space-y-4">
              {sections?.data?.map(section => {
                const sectionModules = modulesBySection.get(section.section_id) ?? [];
                return (
                  <div key={section.section_id} className="bg-white rounded-xl border border-gray-200">
                    <div className="px-6 py-3 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                      <h2 className="font-semibold text-gray-900 text-sm">{section.title}</h2>
                    </div>
                    {sectionModules.length === 0 ? (
                      <p className="px-6 py-4 text-sm text-gray-400">No modules in this section</p>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {sectionModules.map((mod, idx) => {
                          const hidden = (mod as { hidden?: boolean }).hidden;
                          return (
                            <div key={mod.module_id} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 group">
                              <span className="text-gray-300 cursor-grab text-lg select-none">⠿</span>
                              <span className="text-lg">{moduleIcons[mod.module_type] ?? '📌'}</span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${hidden ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{mod.title}</p>
                                <p className="text-xs text-gray-500 capitalize">{mod.module_type}</p>
                              </div>
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => moveModuleMutation.mutate({ moduleId: mod.module_id, position: Math.max(0, idx - 1) })}
                                  disabled={idx === 0}
                                  className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30 px-1"
                                  title="Move up"
                                >
                                  ↑
                                </button>
                                <button
                                  onClick={() => moveModuleMutation.mutate({ moduleId: mod.module_id, position: idx + 1 })}
                                  disabled={idx === sectionModules.length - 1}
                                  className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30 px-1"
                                  title="Move down"
                                >
                                  ↓
                                </button>
                                <button
                                  onClick={() => toggleVisibilityMutation.mutate({ moduleId: mod.module_id, visible: !!hidden })}
                                  className={`text-xs px-2 py-0.5 rounded ${hidden ? 'text-green-600 hover:text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
                                  title={hidden ? 'Show' : 'Hide'}
                                >
                                  {hidden ? 'Show' : 'Hide'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {/* General section */}
              {(modulesBySection.get(undefined)?.length ?? 0) > 0 && (
                <div className="bg-white rounded-xl border border-gray-200">
                  <div className="px-6 py-3 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                    <h2 className="font-semibold text-gray-900 text-sm">General</h2>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {modulesBySection.get(undefined)?.map((mod, idx) => {
                      const generalMods = modulesBySection.get(undefined)!;
                      const hidden = (mod as { hidden?: boolean }).hidden;
                      return (
                        <div key={mod.module_id} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 group">
                          <span className="text-gray-300 cursor-grab text-lg select-none">⠿</span>
                          <span className="text-lg">{moduleIcons[mod.module_type] ?? '📌'}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${hidden ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{mod.title}</p>
                            <p className="text-xs text-gray-500 capitalize">{mod.module_type}</p>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => moveModuleMutation.mutate({ moduleId: mod.module_id, position: Math.max(0, idx - 1) })}
                              disabled={idx === 0}
                              className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30 px-1"
                            >↑</button>
                            <button
                              onClick={() => moveModuleMutation.mutate({ moduleId: mod.module_id, position: idx + 1 })}
                              disabled={idx === generalMods.length - 1}
                              className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30 px-1"
                            >↓</button>
                            <button
                              onClick={() => toggleVisibilityMutation.mutate({ moduleId: mod.module_id, visible: !!hidden })}
                              className={`text-xs px-2 py-0.5 rounded ${hidden ? 'text-green-600 hover:text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                              {hidden ? 'Show' : 'Hide'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {(!sections?.data?.length && !modules?.data?.length) && (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
                  No content yet. Add a section and modules above.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Groupings & Enrolments */}
        <div className="space-y-6">
          {/* Groupings manager */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Groupings</h3>

            {/* Create grouping */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={groupingName}
                onChange={e => setGroupingName(e.target.value)}
                placeholder="Grouping name…"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => { if (e.key === 'Enter' && groupingName.trim()) createGroupingMutation.mutate(); }}
              />
              <button
                onClick={() => createGroupingMutation.mutate()}
                disabled={createGroupingMutation.isPending || !groupingName.trim()}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm transition-colors"
              >
                +
              </button>
            </div>
            {groupingError && <p className="text-xs text-red-600 mb-2">{groupingError}</p>}

            {/* List groupings */}
            <div className="space-y-2 mb-4">
              {groupings?.data?.length === 0 ? (
                <p className="text-sm text-gray-400">No groupings yet</p>
              ) : (
                groupings?.data?.map(gp => (
                  <div key={gp.grouping_id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900">{gp.name}</p>
                      <button
                        onClick={() => deleteGroupingMutation.mutate(gp.grouping_id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {gp.groups?.map(g => (
                        <span key={g.group_id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{g.name}</span>
                      ))}
                      {(!gp.groups || gp.groups.length === 0) && (
                        <span className="text-xs text-gray-400">No groups</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add groups to grouping */}
            {(groupings?.data?.length ?? 0) > 0 && (groups?.data?.length ?? 0) > 0 && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-medium text-gray-600 mb-2">Add groups to grouping</p>
                <select
                  value={selectedGroupingId}
                  onChange={e => setSelectedGroupingId(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select grouping…</option>
                  {groupings?.data?.map(gp => (
                    <option key={gp.grouping_id} value={gp.grouping_id}>{gp.name}</option>
                  ))}
                </select>
                <div className="space-y-1 mb-2">
                  {groups?.data?.map(g => (
                    <label key={g.group_id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedGroupIds.includes(g.group_id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedGroupIds(prev => [...prev, g.group_id]);
                          else setSelectedGroupIds(prev => prev.filter(id => id !== g.group_id));
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="text-gray-700">{g.name}</span>
                    </label>
                  ))}
                </div>
                {addGroupsError && <p className="text-xs text-red-600 mb-1">{addGroupsError}</p>}
                <button
                  onClick={() => addGroupsToGroupingMutation.mutate()}
                  disabled={addGroupsToGroupingMutation.isPending || !selectedGroupingId || selectedGroupIds.length === 0}
                  className="w-full px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm transition-colors"
                >
                  {addGroupsToGroupingMutation.isPending ? 'Adding…' : 'Add Groups'}
                </button>
              </div>
            )}
          </div>

          {/* Enrolment methods */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Enrolment Methods</h3>
              <button
                onClick={() => reconcileMutation.mutate()}
                disabled={reconcileMutation.isPending}
                className="text-xs px-2 py-1 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {reconcileMutation.isPending ? '…' : '↻'}
              </button>
            </div>
            {reconcileMutation.isSuccess && (
              <p className="text-xs text-green-600 mb-2">✓ Reconciled</p>
            )}

            <div className="space-y-2 mb-3">
              {enrolmentMethods?.data?.length === 0 ? (
                <p className="text-sm text-gray-400">No methods yet</p>
              ) : (
                enrolmentMethods?.data?.map(m => (
                  <div key={m.method_id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-900 capitalize">{m.method_type}</span>
                      {m.cohort_id && (
                        <span className="ml-1 text-xs text-purple-600">
                          {cohortMap.get(m.cohort_id!)?.name ?? ''}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => deleteMethodMutation.mutate(m.method_id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-2">
              <select
                value={newMethodType}
                onChange={e => setNewMethodType(e.target.value as 'manual' | 'cohort_sync')}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="manual">Manual</option>
                <option value="cohort_sync">Cohort Sync</option>
              </select>
              {newMethodType === 'cohort_sync' && (
                <select
                  value={newMethodCohort}
                  onChange={e => setNewMethodCohort(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select cohort…</option>
                  {cohorts?.data?.map(c => (
                    <option key={c.cohort_id} value={c.cohort_id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              )}
              {methodError && <p className="text-xs text-red-600">{methodError}</p>}
              <button
                onClick={() => createMethodMutation.mutate()}
                disabled={createMethodMutation.isPending || (newMethodType === 'cohort_sync' && !newMethodCohort)}
                className="w-full px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm transition-colors"
              >
                {createMethodMutation.isPending ? 'Adding…' : 'Add Method'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
