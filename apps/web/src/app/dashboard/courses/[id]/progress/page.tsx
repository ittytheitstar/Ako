'use client';
import React, { use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import type {
  CourseProgressSummary,
  ActivityCompletionState,
  ActivityCompletionRule,
  CourseModule,
  CourseSection,
} from '@ako/shared';

interface Props {
  params: Promise<{ id: string }>;
}

type CompletionState = 'incomplete' | 'complete' | 'complete_pass' | 'complete_fail';

const stateColour = (state: CompletionState | string) => {
  switch (state) {
    case 'complete': return 'bg-green-100 text-green-700';
    case 'complete_pass': return 'bg-emerald-100 text-emerald-700';
    case 'complete_fail': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-500';
  }
};

const stateLabel = (state: CompletionState | string) => {
  switch (state) {
    case 'complete': return 'Complete';
    case 'complete_pass': return 'Passed';
    case 'complete_fail': return 'Attempted';
    default: return 'Incomplete';
  }
};

const stateIcon = (state: CompletionState | string) => {
  switch (state) {
    case 'complete': return '✅';
    case 'complete_pass': return '🏆';
    case 'complete_fail': return '⚠️';
    default: return '○';
  }
};

const moduleTypeIcon: Record<string, string> = {
  page: '📄',
  file: '📎',
  forum: '💬',
  assignment: '📝',
  quiz: '❓',
  lti: '🔗',
  scorm: '📦',
};

export default function CourseProgressPage({ params }: Props) {
  const { id } = use(params);
  const queryClient = useQueryClient();

  const progressQuery = useQuery({
    queryKey: ['course-progress', id],
    queryFn: () => apiClient.getMyCourseProgress(id),
  });

  const courseQuery = useQuery({
    queryKey: ['course', id],
    queryFn: () => apiClient.getCourse(id),
  });

  const sectionsQuery = useQuery({
    queryKey: ['sections', id],
    queryFn: () => apiClient.getSections(id),
  });

  const modulesQuery = useQuery({
    queryKey: ['modules', id],
    queryFn: () => apiClient.getModules(id),
  });

  const progress = progressQuery.data as CourseProgressSummary | undefined;
  const sections = (sectionsQuery.data as { data: CourseSection[] } | undefined)?.data ?? [];
  const allModules = (modulesQuery.data as { data: CourseModule[] } | undefined)?.data ?? [];

  // Fetch per-module states and rules for manual completion
  const statesQuery = useQuery({
    queryKey: ['completion-states-all', id, allModules.map(m => m.module_id)],
    queryFn: async () => {
      if (allModules.length === 0) return {};
      const results = await Promise.allSettled(
        allModules.map(m => apiClient.getMyModuleCompletionState(m.module_id))
      );
      const map: Record<string, ActivityCompletionState | { module_id: string; user_id: string; state: string }> = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') map[allModules[i].module_id] = r.value;
      });
      return map;
    },
    enabled: allModules.length > 0,
  });

  const rulesQuery = useQuery({
    queryKey: ['completion-rules-all', id, allModules.map(m => m.module_id)],
    queryFn: async () => {
      if (allModules.length === 0) return {};
      const results = await Promise.allSettled(
        allModules.map(m => apiClient.getModuleCompletionRule(m.module_id))
      );
      const map: Record<string, ActivityCompletionRule | null> = {};
      results.forEach((r, i) => {
        map[allModules[i].module_id] = r.status === 'fulfilled' ? r.value : null;
      });
      return map;
    },
    enabled: allModules.length > 0,
  });

  const markComplete = useMutation({
    mutationFn: (moduleId: string) => apiClient.markModuleComplete(moduleId, { completion_source: 'manual' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-progress', id] });
      queryClient.invalidateQueries({ queryKey: ['completion-states-all', id] });
    },
  });

  const undoComplete = useMutation({
    mutationFn: (moduleId: string) => apiClient.undoModuleComplete(moduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-progress', id] });
      queryClient.invalidateQueries({ queryKey: ['completion-states-all', id] });
    },
  });

  const stateMap = statesQuery.data ?? {};
  const rulesMap = rulesQuery.data ?? {};

  const progressPct = progress?.progress_pct ?? 0;
  const courseState = progress?.state ?? 'incomplete';

  const courseStateLabel = courseState === 'complete'
    ? 'Complete'
    : courseState === 'in_progress'
    ? 'In Progress'
    : 'Not Started';

  const courseStateBadge =
    courseState === 'complete'
      ? 'bg-green-100 text-green-700'
      : courseState === 'in_progress'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-gray-100 text-gray-500';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {courseQuery.data?.title ?? 'Course'} – My Progress
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track your completion across all activities</p>
        </div>
        <Link href={`/dashboard/courses/${id}`} className="text-sm text-blue-600 hover:underline">
          ← Back to Course
        </Link>
      </div>

      {/* Progress summary card */}
      {progress && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Overall Progress</p>
              <p className="text-3xl font-bold text-gray-900">{progressPct}%</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${courseStateBadge}`}>
              {courseStateLabel}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4 pt-2">
            <StatChip label="Complete" value={progress.complete_count} colour="green" />
            <StatChip label="Remaining" value={progress.incomplete_count} colour="gray" />
            <StatChip label="Passed" value={progress.complete_pass_count} colour="emerald" />
            <StatChip label="Total" value={progress.total_tracked} colour="blue" />
          </div>

          {progress.completed_at && (
            <p className="text-sm text-green-700 font-medium">
              🎉 Course completed on {new Date(progress.completed_at).toLocaleDateString('en-NZ', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          )}
        </div>
      )}

      {/* Loading state */}
      {progressQuery.isLoading && (
        <div className="text-center py-8 text-gray-500">Loading your progress…</div>
      )}

      {/* Sections and modules */}
      {sections.map(section => {
        const sectionModules = allModules.filter(m => m.section_id === section.section_id);
        if (sectionModules.length === 0) return null;

        const trackedModules = sectionModules.filter(m => rulesMap[m.module_id]);
        const completedInSection = trackedModules.filter(m => {
          const s = stateMap[m.module_id]?.state;
          return s === 'complete' || s === 'complete_pass' || s === 'complete_fail';
        }).length;
        const sectionPct = trackedModules.length > 0
          ? Math.round((completedInSection / trackedModules.length) * 100)
          : null;

        return (
          <section key={section.section_id} className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">{section.title}</h2>
              {sectionPct !== null && (
                <span className="text-xs text-gray-500">{completedInSection}/{trackedModules.length} complete</span>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
              {sectionModules.map(module => {
                const rule = rulesMap[module.module_id];
                const stateEntry = stateMap[module.module_id];
                const currentState = stateEntry?.state ?? 'incomplete';
                const isTracked = !!rule;
                const isManual = rule?.completion_type === 'manual';

                return (
                  <div key={module.module_id} className="flex items-center gap-4 px-4 py-3">
                    {/* Completion indicator / checkbox */}
                    <div className="flex-shrink-0 w-8 text-center">
                      {isManual ? (
                        <button
                          onClick={() => {
                            if (currentState === 'incomplete') {
                              markComplete.mutate(module.module_id);
                            } else {
                              undoComplete.mutate(module.module_id);
                            }
                          }}
                          aria-label={currentState !== 'incomplete' ? `Mark "${module.title}" incomplete` : `Mark "${module.title}" complete`}
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                            currentState !== 'incomplete'
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-gray-300 hover:border-green-400'
                          }`}
                          title={currentState !== 'incomplete' ? 'Mark incomplete' : 'Mark complete'}
                        >
                          {currentState !== 'incomplete' && '✓'}
                        </button>
                      ) : (
                        <span className="text-lg">{isTracked ? stateIcon(currentState) : '—'}</span>
                      )}
                    </div>

                    {/* Module info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span>{moduleTypeIcon[module.module_type] ?? '📄'}</span>
                        <span className="font-medium text-gray-900 truncate">{module.title}</span>
                      </div>
                      {rule && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Completion: {rule.completion_type}
                          {rule.passing_grade != null ? ` (pass ≥ ${rule.passing_grade}%)` : ''}
                          {rule?.expected_completion_date ? ` · target ${new Date(rule.expected_completion_date).toLocaleDateString('en-NZ', { year: 'numeric', month: 'short', day: 'numeric' })}` : ''}
                        </p>
                      )}
                    </div>

                    {/* State badge */}
                    {isTracked && (
                      <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${stateColour(currentState)}`}>
                        {stateLabel(currentState)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {sectionsQuery.isLoading && (
        <div className="text-center py-8 text-gray-500">Loading course content…</div>
      )}

      {sections.length === 0 && !sectionsQuery.isLoading && (
        <div className="text-center py-8 text-gray-400">No content sections found for this course.</div>
      )}
    </div>
  );
}

function StatChip({ label, value, colour }: { label: string; value: number; colour: string }) {
  const colours: Record<string, string> = {
    green: 'bg-green-50 text-green-800',
    emerald: 'bg-emerald-50 text-emerald-800',
    gray: 'bg-gray-50 text-gray-700',
    blue: 'bg-blue-50 text-blue-800',
  };
  return (
    <div className={`rounded-lg p-3 text-center ${colours[colour] ?? colours.gray}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs mt-0.5">{label}</p>
    </div>
  );
}
