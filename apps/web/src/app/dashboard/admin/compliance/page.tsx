'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

export default function ComplianceDashboardPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'audit' | 'exports' | 'holds'>('audit');
  const [exportError, setExportError] = useState<string | null>(null);

  const auditQuery = useQuery({
    queryKey: ['audit-events'],
    queryFn: () => apiClient.getAuditEvents({ limit: 50 }),
    enabled: activeTab === 'audit',
  });

  const exportsQuery = useQuery({
    queryKey: ['export-jobs'],
    queryFn: () => apiClient.getExports(),
    enabled: activeTab === 'exports',
    refetchInterval: 5000, // poll for status updates
  });

  const holdsQuery = useQuery({
    queryKey: ['legal-holds'],
    queryFn: async () => {
      const courses = await apiClient.getCourses();
      return { data: courses.data?.filter(c => c.legal_hold) ?? [] };
    },
    enabled: activeTab === 'holds',
  });

  const createExportMutation = useMutation({
    mutationFn: (exportType: 'course_archive' | 'assessment_evidence' | 'engagement_metrics') =>
      apiClient.createExport({ export_type: exportType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-jobs'] });
      setExportError(null);
    },
    onError: (e: Error) => setExportError(e.message),
  });

  const removeHoldMutation = useMutation({
    mutationFn: (courseId: string) => apiClient.setLegalHold(courseId, false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal-holds'] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });

  const tabs = [
    { id: 'audit' as const, label: 'Audit Log', icon: '📋' },
    { id: 'exports' as const, label: 'Export Jobs', icon: '📤' },
    { id: 'holds' as const, label: 'Legal Holds', icon: '🔒' },
  ];

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'running': return 'bg-blue-100 text-blue-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Link href="/dashboard" className="hover:text-blue-600">Dashboard</Link>
          <span>›</span>
          <span className="text-gray-900">Compliance Dashboard</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Compliance Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Monitor audit trails, export jobs, and legal holds for governance and compliance.
        </p>
      </div>

      {exportError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {exportError}
          <button onClick={() => setExportError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Audit Events</h2>
          </div>
          {auditQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : auditQuery.data?.data?.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">No audit events recorded yet.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {auditQuery.data?.data?.map(event => (
                <div key={event.event_id} className="px-6 py-4 flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm">
                      {event.event_type.startsWith('course.archived') ? '📦' :
                       event.event_type.startsWith('course.restored') ? '♻️' :
                       event.event_type.startsWith('export') ? '📤' :
                       event.event_type.startsWith('retention') ? '📋' :
                       event.event_type.includes('legal_hold') ? '🔒' : '📝'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 font-mono">{event.event_type}</span>
                      {event.resource_type && (
                        <span className="text-xs text-gray-500">on {event.resource_type}</span>
                      )}
                    </div>
                    {(event as unknown as Record<string, unknown>).actor_name ? (
                      <p className="text-xs text-gray-500 mt-0.5">
                        by {String((event as unknown as Record<string, unknown>).actor_name)}
                        {(event as unknown as Record<string, unknown>).actor_email ? ` (${String((event as unknown as Record<string, unknown>).actor_email)})` : ''}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Exports Tab */}
      {activeTab === 'exports' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Request New Export</h3>
            <div className="flex flex-wrap gap-3">
              {([
                { type: 'course_archive' as const, label: 'Course Archive', icon: '📦' },
                { type: 'assessment_evidence' as const, label: 'Assessment Evidence', icon: '📝' },
                { type: 'engagement_metrics' as const, label: 'Engagement Metrics', icon: '📈' },
              ] as const).map(({ type, label, icon }) => (
                <button
                  key={type}
                  onClick={() => createExportMutation.mutate(type)}
                  disabled={createExportMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  <span>{icon}</span> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Export Jobs</h2>
            </div>
            {exportsQuery.isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : exportsQuery.data?.data?.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">No exports yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-6 py-3 text-left">Type</th>
                      <th className="px-6 py-3 text-center">Status</th>
                      <th className="px-6 py-3 text-right">Size</th>
                      <th className="px-6 py-3 text-right">Requested</th>
                      <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {exportsQuery.data?.data?.map(job => (
                      <tr key={job.export_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-900">
                            {job.export_type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(job.status)}`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-gray-500">
                          {job.file_size_bytes
                            ? `${(job.file_size_bytes / 1024).toFixed(1)} KB`
                            : '—'}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-gray-500">
                          {new Date(job.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {job.status === 'completed' && (
                            <button
                              onClick={() => apiClient.getExportDownload(job.export_id)
                                .then(d => window.open(d.download_url, '_blank'))
                                .catch(e => setExportError(e.message))
                              }
                              className="text-sm text-blue-600 hover:text-blue-800"
                            >
                              Download
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legal Holds Tab */}
      {activeTab === 'holds' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Courses Under Legal Hold</h2>
          </div>
          {holdsQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : holdsQuery.data?.data?.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No courses are currently under legal hold.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {holdsQuery.data?.data?.map(course => (
                <div key={course.course_id} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{course.title}</p>
                    <p className="text-sm text-gray-500">{course.course_code}</p>
                    {course.retention_until && (
                      <p className="text-xs text-gray-400 mt-1">
                        Retain until {new Date(course.retention_until).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    🔒 Legal Hold
                  </span>
                  <button
                    onClick={() => removeHoldMutation.mutate(course.course_id)}
                    disabled={removeHoldMutation.isPending}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    Remove Hold
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
