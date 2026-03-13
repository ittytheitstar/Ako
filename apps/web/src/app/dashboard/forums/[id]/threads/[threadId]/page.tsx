'use client';
import React, { useState, useEffect, useRef, use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getAccessToken } from '@/lib/api';
import { RealtimeClient } from '@/lib/ws';
import Link from 'next/link';

interface Props { params: Promise<{ id: string; threadId: string }> }

export default function ThreadPage({ params }: Props) {
  const { id, threadId } = React.use(params);
  const { id, threadId } = use(params);
  const qc = useQueryClient();
  const [reply, setReply] = useState('');
  const rtRef = useRef<RealtimeClient | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: thread } = useQuery({
    queryKey: ['thread', id, threadId],
    queryFn: () => apiClient.getThread(id, threadId),
  });

  const { data: posts, isLoading } = useQuery({
    queryKey: ['posts', id, threadId],
    queryFn: () => apiClient.getPosts(id, threadId),
  });

  // Realtime updates
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const rt = new RealtimeClient(token);
    rt.connect();
    const channel = `forum:${id}:thread:${threadId}`;
    const unsub = rt.subscribe(channel, (msg) => {
      if (msg.type === 'event' && (msg.event === 'post.created' || msg.event === 'post.updated')) {
        qc.invalidateQueries({ queryKey: ['posts', id, threadId] });
      }
    });
    rtRef.current = rt;
    return () => {
      unsub();
      rt.disconnect();
    };
  }, [id, threadId, qc]);

  const createPost = useMutation({
    mutationFn: (text: string) => apiClient.createPost(id, threadId, { text }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts', id, threadId] });
      setReply('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    },
  });

  return (
    <div className="p-8">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/dashboard/forums" className="hover:text-blue-600">Forums</Link>
        <span>›</span>
        <Link href={`/dashboard/forums/${id}`} className="hover:text-blue-600">Forum</Link>
        <span>›</span>
        <span className="text-gray-900 truncate">{thread?.title}</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">{thread?.title}</h1>

      <div className="space-y-4 mb-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : posts?.data?.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-white rounded-xl border border-gray-200">
            No posts yet. Be the first to reply!
          </div>
        ) : (
          posts?.data?.map((post, idx) => (
            <div key={post.post_id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {idx + 1}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Post #{idx + 1}</p>
                  <p className="text-xs text-gray-500">{new Date(post.created_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="text-gray-700 text-sm">
                {typeof post.body === 'object' && post.body !== null && 'text' in post.body
                  ? (post.body as { text: string }).text
                  : JSON.stringify(post.body)}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {!thread?.locked && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-medium text-gray-900 mb-3">Reply</h3>
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder="Write your reply..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={() => reply.trim() && createPost.mutate(reply.trim())}
              disabled={!reply.trim() || createPost.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {createPost.isPending ? 'Posting...' : 'Post Reply'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
