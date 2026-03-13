'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { CalendarReminderPref } from '@ako/shared';

const EVENT_TYPES = [
  { key: 'assignment', label: 'Assignments', icon: '📝', description: 'Due date reminders for assignments' },
  { key: 'quiz', label: 'Quizzes', icon: '🧩', description: 'Quiz open/close window reminders' },
  { key: 'course_event', label: 'Course Events', icon: '📚', description: 'Lectures, labs, and course sessions' },
  { key: 'cohort_event', label: 'Cohort Events', icon: '👥', description: 'Cohort orientations and intake dates' },
  { key: 'system', label: 'Institutional', icon: '🏫', description: 'Holidays, enrolment deadlines' },
];

const INTERVAL_OPTIONS = [
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
  { value: 4320, label: '3 days before' },
  { value: 10080, label: '1 week before' },
];

function getPrefForType(prefs: CalendarReminderPref[], eventType: string): CalendarReminderPref | undefined {
  return prefs.find(p => p.event_type === eventType);
}

export default function CalendarPreferencesPage() {
  const queryClient = useQueryClient();

  const { data: prefsData, isLoading } = useQuery({
    queryKey: ['calendar-reminder-prefs'],
    queryFn: () => apiClient.getCalendarReminderPrefs(),
  });

  const prefs = (prefsData?.data ?? []) as CalendarReminderPref[];

  // Local state for editing
  const [localPrefs, setLocalPrefs] = useState<Record<string, { enabled: boolean; intervals: number[] }>>({});

  const getEnabled = (type: string) => {
    if (type in localPrefs) return localPrefs[type].enabled;
    return getPrefForType(prefs, type)?.enabled ?? true;
  };

  const getIntervals = (type: string) => {
    if (type in localPrefs) return localPrefs[type].intervals;
    return getPrefForType(prefs, type)?.intervals ?? [1440, 4320, 10080];
  };

  const setEnabled = (type: string, enabled: boolean) => {
    setLocalPrefs(p => ({ ...p, [type]: { enabled, intervals: getIntervals(type) } }));
  };

  const toggleInterval = (type: string, interval: number) => {
    const current = getIntervals(type);
    const next = current.includes(interval)
      ? current.filter(i => i !== interval)
      : [...current, interval].sort((a, b) => a - b);
    setLocalPrefs(p => ({ ...p, [type]: { enabled: getEnabled(type), intervals: next } }));
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const prefsList = EVENT_TYPES.map(t => ({
        event_type: t.key,
        enabled: getEnabled(t.key),
        intervals: getIntervals(t.key),
      }));
      return apiClient.updateCalendarReminderPrefs(prefsList);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-reminder-prefs'] });
      setLocalPrefs({});
    },
  });

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reminder Preferences</h1>
        <p className="text-gray-500 mt-1">Choose which events to receive reminders for and when</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-4">
          {EVENT_TYPES.map(type => {
            const enabled = getEnabled(type.key);
            const intervals = getIntervals(type.key);
            return (
              <div key={type.key} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{type.icon}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">{type.label}</h3>
                      <p className="text-xs text-gray-500">{type.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEnabled(type.key, !enabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                </div>
                {enabled && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2 font-medium">Remind me:</p>
                    <div className="flex flex-wrap gap-2">
                      {INTERVAL_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => toggleInterval(type.key, opt.value)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                            intervals.includes(opt.value)
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-300 text-gray-600 hover:border-blue-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex justify-end pt-2">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || Object.keys(localPrefs).length === 0}
              className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save Preferences'}
            </button>
          </div>
          {saveMutation.isSuccess && (
            <p className="text-sm text-green-600 text-center">Preferences saved successfully.</p>
          )}
        </div>
      )}
    </div>
  );
}
