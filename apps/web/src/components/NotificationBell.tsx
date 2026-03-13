'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient.getNotifications(),
    refetchInterval: 30000,
  });

  const unreadCount = notifications?.data?.filter(n => !n.read_at).length ?? 0;

  const markAll = useMutation({
    mutationFn: () => apiClient.markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markOne = useMutation({
    mutationFn: (id: string) => apiClient.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function kindLabel(kind: string) {
    switch (kind) {
      case 'forum_post': return '💬 New forum reply';
      case 'message': return '✉ New message';
      case 'announcement': return '📢 Announcement';
      case 'assignment_graded': return '📊 Assignment graded';
      default: return '🔔 Notification';
    }
  }

  function notifLink(notif: { kind: string; payload: Record<string, unknown> }) {
    if (notif.kind === 'forum_post' && notif.payload.forum_id && notif.payload.thread_id) {
      return `/dashboard/forums/${notif.payload.forum_id}/threads/${notif.payload.thread_id}`;
    }
    if (notif.kind === 'message' && notif.payload.conversation_id) {
      return `/dashboard/messages`;
    }
    if (notif.kind === 'announcement' && notif.payload.course_id) {
      return `/dashboard/courses/${notif.payload.course_id}/announcements`;
    }
    return null;
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 text-gray-300 hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifications?.data?.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No notifications</p>
            ) : (
              notifications?.data?.slice(0, 15).map(notif => {
                const href = notifLink(notif);
                const content = (
                  <div
                    className={`flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${!notif.read_at ? 'bg-blue-50' : ''}`}
                    onClick={() => !notif.read_at && markOne.mutate(notif.notification_id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{kindLabel(notif.kind)}</p>
                      {notif.payload.title != null && (
                        <p className="text-xs text-gray-600 truncate mt-0.5">{String(notif.payload.title)}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(notif.created_at).toLocaleString()}</p>
                    </div>
                    {!notif.read_at && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                    )}
                  </div>
                );
                return href ? (
                  <Link key={notif.notification_id} href={href} onClick={() => setOpen(false)}>
                    {content}
                  </Link>
                ) : (
                  <div key={notif.notification_id}>{content}</div>
                );
              })
            )}
          </div>
          <div className="border-t border-gray-100 px-4 py-2">
            <Link
              href="/dashboard/notifications"
              className="text-xs text-blue-600 hover:text-blue-700"
              onClick={() => setOpen(false)}
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
