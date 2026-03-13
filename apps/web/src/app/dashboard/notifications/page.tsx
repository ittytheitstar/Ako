'use client';
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

function kindIcon(kind: string) {
  switch (kind) {
    case 'forum_post': return '💬';
    case 'message': return '✉';
    case 'announcement': return '📢';
    case 'assignment_graded': return '📊';
    default: return '🔔';
  }
}

function kindLabel(kind: string) {
  switch (kind) {
    case 'forum_post': return 'Forum reply';
    case 'message': return 'New message';
    case 'announcement': return 'Announcement';
    case 'assignment_graded': return 'Assignment graded';
    default: return 'Notification';
  }
}

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient.getNotifications(),
  });

  const markAll = useMutation({
    mutationFn: () => apiClient.markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markOne = useMutation({
    mutationFn: (id: string) => apiClient.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unread = data?.data?.filter(n => !n.read_at) ?? [];

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500 mt-1">
            {unread.length > 0 ? `${unread.length} unread` : 'All caught up'}
          </p>
        </div>
        {unread.length > 0 && (
          <button
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-300 rounded-lg disabled:opacity-50"
          >
            Mark all as read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : data?.data?.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-4xl mb-3">🔔</p>
          <p className="text-gray-500">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data?.data?.map(notif => (
            <div
              key={notif.notification_id}
              className={`flex gap-4 p-4 bg-white rounded-xl border transition-colors ${
                !notif.read_at ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="text-2xl">{kindIcon(notif.kind)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-gray-900 text-sm">{kindLabel(notif.kind)}</p>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(notif.created_at).toLocaleString()}
                  </span>
                </div>
                {notif.payload.title != null && (
                  <p className="text-sm text-gray-600 mt-0.5 truncate">{String(notif.payload.title)}</p>
                )}
                {notif.payload.thread_title != null && (
                  <p className="text-sm text-gray-600 mt-0.5 truncate">Thread: {String(notif.payload.thread_title)}</p>
                )}
              </div>
              {!notif.read_at && (
                <button
                  onClick={() => markOne.mutate(notif.notification_id)}
                  className="text-xs text-blue-600 hover:text-blue-700 flex-shrink-0 self-center"
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
