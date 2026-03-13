'use client';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

type ReportTab = 'enrolments' | 'activity' | 'completion' | 'forum';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('enrolments');

  const enrolmentsQuery = useQuery({
    queryKey: ['report-enrolments'],
    queryFn: () => apiClient.getEnrolmentReport(),
    enabled: activeTab === 'enrolments',
  });

  const activityQuery = useQuery({
    queryKey: ['report-activity'],
    queryFn: () => apiClient.getActivityReport(),
    enabled: activeTab === 'activity',
  });

  const completionQuery = useQuery({
    queryKey: ['report-completion'],
    queryFn: () => apiClient.getCompletionReport(),
    enabled: activeTab === 'completion',
  });

  const forumQuery = useQuery({
    queryKey: ['report-forum'],
    queryFn: () => apiClient.getForumEngagementReport(),
    enabled: activeTab === 'forum',
  });

  const tabs: { id: ReportTab; label: string; icon: string }[] = [
    { id: 'enrolments', label: 'Enrolments', icon: '👥' },
    { id: 'activity', label: 'Activity', icon: '📈' },
    { id: 'completion', label: 'Completion', icon: '✅' },
    { id: 'forum', label: 'Forum Engagement', icon: '💬' },
  ];

  const isLoading =
    (activeTab === 'enrolments' && enrolmentsQuery.isLoading) ||
    (activeTab === 'activity' && activityQuery.isLoading) ||
    (activeTab === 'completion' && completionQuery.isLoading) ||
    (activeTab === 'forum' && forumQuery.isLoading);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-gray-500 mt-1">
          Read-only analytics views — no impact on live system performance.
        </p>
      </div>

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

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {/* Enrolments Report */}
          {activeTab === 'enrolments' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Enrolments by Course</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-6 py-3 text-left">Course</th>
                      <th className="px-6 py-3 text-right">Total</th>
                      <th className="px-6 py-3 text-right">Active</th>
                      <th className="px-6 py-3 text-right">Completed</th>
                      <th className="px-6 py-3 text-right">Suspended</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {enrolmentsQuery.data?.data?.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No data available</td>
                      </tr>
                    ) : (
                      enrolmentsQuery.data?.data?.map((row) => (
                        <tr key={row.course_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <p className="font-medium text-gray-900">{row.title}</p>
                            <p className="text-xs text-gray-500">{row.course_code}</p>
                          </td>
                          <td className="px-6 py-4 text-right font-medium">{row.total_enrolments}</td>
                          <td className="px-6 py-4 text-right text-green-600">{row.active_enrolments}</td>
                          <td className="px-6 py-4 text-right text-blue-600">{row.completed_enrolments}</td>
                          <td className="px-6 py-4 text-right text-orange-600">{row.suspended_enrolments}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Activity Report */}
          {activeTab === 'activity' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Activity Participation</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-6 py-3 text-left">Course</th>
                      <th className="px-6 py-3 text-right">Forum Posts</th>
                      <th className="px-6 py-3 text-right">Submissions</th>
                      <th className="px-6 py-3 text-right">Active Learners</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activityQuery.data?.data?.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No data available</td>
                      </tr>
                    ) : (
                      activityQuery.data?.data?.map((row) => (
                        <tr key={row.course_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <p className="font-medium text-gray-900">{row.title}</p>
                            <p className="text-xs text-gray-500">{row.course_code}</p>
                          </td>
                          <td className="px-6 py-4 text-right">{row.total_posts}</td>
                          <td className="px-6 py-4 text-right">{row.total_submissions}</td>
                          <td className="px-6 py-4 text-right font-medium text-blue-600">{row.active_learners}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Completion Report */}
          {activeTab === 'completion' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Completion & Progression</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-6 py-3 text-left">Course</th>
                      <th className="px-6 py-3 text-right">Enrolled</th>
                      <th className="px-6 py-3 text-right">Completed</th>
                      <th className="px-6 py-3 text-right">Completion Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {completionQuery.data?.data?.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No data available</td>
                      </tr>
                    ) : (
                      completionQuery.data?.data?.map((row) => (
                        <tr key={row.course_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <p className="font-medium text-gray-900">{row.title}</p>
                            <p className="text-xs text-gray-500">{row.course_code}</p>
                          </td>
                          <td className="px-6 py-4 text-right">{row.total_enrolments}</td>
                          <td className="px-6 py-4 text-right text-green-600">{row.completed_count}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-green-500 h-2 rounded-full"
                                  style={{ width: `${row.completion_rate}%` }}
                                />
                              </div>
                              <span className="font-medium text-gray-900 w-12 text-right">
                                {row.completion_rate}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Forum Engagement Report */}
          {activeTab === 'forum' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Forum Engagement</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-6 py-3 text-left">Course</th>
                      <th className="px-6 py-3 text-right">Forums</th>
                      <th className="px-6 py-3 text-right">Threads</th>
                      <th className="px-6 py-3 text-right">Posts</th>
                      <th className="px-6 py-3 text-right">Contributors</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {forumQuery.data?.data?.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No data available</td>
                      </tr>
                    ) : (
                      (forumQuery.data?.data as Record<string, unknown>[])?.map((row) => (
                        <tr key={row.course_id as string} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <p className="font-medium text-gray-900">{row.title as string}</p>
                            <p className="text-xs text-gray-500">{row.course_code as string}</p>
                          </td>
                          <td className="px-6 py-4 text-right">{row.total_forums as number}</td>
                          <td className="px-6 py-4 text-right">{row.total_threads as number}</td>
                          <td className="px-6 py-4 text-right">{row.total_posts as number}</td>
                          <td className="px-6 py-4 text-right font-medium text-purple-600">{row.unique_contributors as number}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
