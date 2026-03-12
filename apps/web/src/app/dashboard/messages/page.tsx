'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export default function MessagesPage() {
  const qc = useQueryClient();
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [text, setText] = useState('');

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiClient.getConversations(),
  });

  const { data: messages } = useQuery({
    queryKey: ['messages', selectedConv],
    queryFn: () => apiClient.getMessages(selectedConv!),
    enabled: !!selectedConv,
    refetchInterval: 3000,
  });

  const sendMessage = useMutation({
    mutationFn: (body: string) => apiClient.sendMessage(selectedConv!, { text: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', selectedConv] });
      setText('');
    },
  });

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
      </div>
      <div className="flex gap-4 flex-1 min-h-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="w-64 border-r border-gray-100 overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-700">Conversations</p>
          </div>
          {conversations?.data?.map((conv) => (
            <button
              key={conv.conversation_id}
              onClick={() => setSelectedConv(conv.conversation_id)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedConv === conv.conversation_id ? 'bg-blue-50 border-r-2 border-blue-600' : ''}`}
            >
              <p className="text-sm font-medium text-gray-900">
                {conv.title ?? `Conversation ${conv.conversation_id.slice(0, 8)}`}
              </p>
              <p className="text-xs text-gray-500">{new Date(conv.created_at).toLocaleDateString()}</p>
            </button>
          ))}
          {conversations?.data?.length === 0 && (
            <p className="p-4 text-sm text-gray-500">No conversations</p>
          )}
        </div>
        <div className="flex-1 flex flex-col">
          {selectedConv ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages?.data?.map((msg) => (
                  <div key={msg.message_id} className="flex gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-medium">
                      U
                    </div>
                    <div className="bg-gray-100 rounded-xl px-4 py-2 text-sm max-w-xs">
                      {typeof msg.body === 'object' && msg.body !== null && 'text' in msg.body
                        ? (msg.body as { text: string }).text
                        : JSON.stringify(msg.body)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 p-4 flex gap-2">
                <input
                  type="text"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey && text.trim()) {
                      sendMessage.mutate(text.trim());
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => text.trim() && sendMessage.mutate(text.trim())}
                  disabled={!text.trim() || sendMessage.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Select a conversation to start messaging
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
