'use client';
import React, { useState, use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

interface Props { params: Promise<{ id: string }> }

export default function AnnouncementsPage({ params }: Props) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const { data: course } = useQuery({
    queryKey: ['course', id],
    queryFn: () => apiClient.getCourse(id),
  });

  const { data: announcements, isLoading } = useQuery({
    queryKey: ['announcements', id],
    queryFn: () => apiClient.getCourseAnnouncements(id),
  });

  const create = useMutation({
    mutationFn: () =>
      apiClient.createAnnouncement(id, {
        title,
        body: { text: body },
        channel: 'course',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements', id] });
      setTitle('');
      setBody('');
      setShowCreate(false);
    },
  });

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/dashboard/courses" className="hover:text-blue-600">Courses</Link>
        <span>›</span>
        <Link href={`/dashboard/courses/${id}`} className="hover:text-blue-600">
          {course?.title ?? 'Course'}
        </Link>
        <span>›</span>
        <span className="text-gray-900">Announcements</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-gray-500 mt-1">{course?.title}</p>
        </div>
        <button
          onClick={() => setShowCreate(s => !s)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {showCreate ? 'Cancel' : '+ New Announcement'}
        </button>
      </div>

      {showCreate && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <h3 className="font-medium text-gray-900 mb-3">Create Announcement</h3>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write your announcement..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-3"
          />
          <div className="flex justify-end">
            <button
              onClick={() => title.trim() && body.trim() && create.mutate()}
              disabled={!title.trim() || !body.trim() || create.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {create.isPending ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : announcements?.data?.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-4xl mb-3">📢</p>
          <p className="text-gray-500">No announcements yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements?.data?.map(ann => (
            <div key={ann.announcement_id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-orange-600 text-xl">📢</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">{ann.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ann.published_at
                      ? `Published ${new Date(ann.published_at).toLocaleString()}`
                      : ann.scheduled_at
                      ? `Scheduled for ${new Date(ann.scheduled_at).toLocaleString()}`
                      : 'Draft'}
                  </p>
                  {ann.body && typeof ann.body === 'object' && 'text' in ann.body && (
                    <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">
                      {String((ann.body as { text: string }).text)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
