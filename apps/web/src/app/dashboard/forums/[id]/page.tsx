'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

interface Props { params: { id: string } }

export default function ForumPage({ params }: Props) {
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState('');
  const [showNew, setShowNew] = useState(false);

  const { data: forum } = useQuery({
    queryKey: ['forum', params.id],
    queryFn: () => apiClient.getForum(params.id),
  });

  const { data: threads, isLoading } = useQuery({
    queryKey: ['threads', params.id],
    queryFn: () => apiClient.getThreads(params.id),
  });

  const createThread = useMutation({
    mutationFn: (title: string) => apiClient.createThread(params.id, { title }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['threads', params.id] });
      setNewTitle('');
      setShowNew(false);
    },
  });

  return (
    <div className="p-8">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/dashboard/forums" className="hover:text-blue-600">Forums</Link>
        <span>›</span>
        <span className="text-gray-900">{forum?.title}</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{forum?.title ?? 'Forum'}</h1>
        <button
          onClick={() => setShowNew(!showNew)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          New Thread
        </button>
      </div>

      {showNew && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <h3 className="font-medium text-gray-900 mb-3">Start New Thread</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Thread title..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => newTitle.trim() && createThread.mutate(newTitle.trim())}
              disabled={!newTitle.trim() || createThread.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-2">
          {threads?.data?.map((thread) => (
            <Link
              key={thread.thread_id}
              href={`/dashboard/forums/${params.id}/threads/${thread.thread_id}`}
              className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex-1">
                <p className="font-medium text-gray-900">{thread.title}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {thread.locked && <span className="mr-2 text-orange-500">🔒 Locked</span>}
                  Created {new Date(thread.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className="text-blue-600 text-sm">View →</span>
            </Link>
          ))}
          {threads?.data?.length === 0 && (
            <div className="text-center py-16 text-gray-500">No threads yet. Start the conversation!</div>
          )}
        </div>
      )}
    </div>
  );
}
