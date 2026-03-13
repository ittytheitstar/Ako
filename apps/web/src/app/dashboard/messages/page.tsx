'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getAccessToken } from '@/lib/api';
import { RealtimeClient } from '@/lib/ws';

function PresenceDot({ status }: { status?: string }) {
  const color = status === 'online' ? 'bg-green-400' : status === 'idle' ? 'bg-yellow-400' : 'bg-gray-300';
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

export default function MessagesPage() {
  const qc = useQueryClient();
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const rtRef = useRef<RealtimeClient | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiClient.getConversations(),
    refetchInterval: 10000,
  });

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ['messages', selectedConv],
    queryFn: () => apiClient.getMessages(selectedConv!),
    enabled: !!selectedConv,
  });

  // Realtime for messages
  useEffect(() => {
    if (!selectedConv) return;
    const token = getAccessToken();
    if (!token) return;
    const rt = new RealtimeClient(token);
    rt.connect();
    const channel = `dm:${selectedConv}`;
    const unsub = rt.subscribe(channel, (msg) => {
      if (msg.type === 'event' && msg.event === 'message.created') {
        refetchMessages();
        qc.invalidateQueries({ queryKey: ['conversations'] });
      }
      if (msg.type === 'typing' && msg.userId) {
        setTypingUsers(prev => {
          const next = new Set(prev);
          next.add(msg.userId!);
          return next;
        });
        setTimeout(() => {
          setTypingUsers(prev => {
            const next = new Set(prev);
            next.delete(msg.userId!);
            return next;
          });
        }, 3000);
      }
    });
    rtRef.current = rt;
    return () => {
      unsub();
      rt.disconnect();
    };
  }, [selectedConv, qc, refetchMessages]);

  // Mark conversation as read when selected
  useEffect(() => {
    if (selectedConv) {
      apiClient.markConversationRead(selectedConv).catch(() => {});
      qc.invalidateQueries({ queryKey: ['conversations'] });
    }
  }, [selectedConv, qc]);

  // Scroll to bottom on new messages
  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [messages?.data?.length]);

  const sendMessage = useMutation({
    mutationFn: (body: string) => apiClient.sendMessage(selectedConv!, { text: body }),
    onSuccess: () => {
      refetchMessages();
      qc.invalidateQueries({ queryKey: ['conversations'] });
      setText('');
    },
  });

  function sendTyping() {
    if (rtRef.current && selectedConv) {
      const ws = (rtRef.current as unknown as { ws: WebSocket | null }).ws;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'typing', channel: `dm:${selectedConv}` }));
      }
    }
  }

  const selectedConvData = conversations?.data?.find(c => c.conversation_id === selectedConv);

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
      </div>
      <div className="flex gap-4 flex-1 min-h-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 border-r border-gray-100 flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Conversations</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations?.data?.map((conv) => {
              const lastRead = conv.last_read_at ? new Date(conv.last_read_at).getTime() : 0;
              const lastMsg = conv.last_message_at ? new Date(conv.last_message_at).getTime() : 0;
              const unread = lastMsg > 0 && (lastRead === 0 || lastMsg > lastRead);
              return (
                <button
                  key={conv.conversation_id}
                  onClick={() => setSelectedConv(conv.conversation_id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                    selectedConv === conv.conversation_id ? 'bg-blue-50 border-r-2 border-blue-600' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-medium text-gray-900 ${unread ? 'font-semibold' : ''}`}>
                      {conv.convo_type === 'dm' ? 'Direct Message' : `${conv.convo_type} chat`}
                    </p>
                    {unread && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {conv.last_message_at
                      ? new Date(conv.last_message_at).toLocaleDateString()
                      : new Date(conv.created_at).toLocaleDateString()}
                  </p>
                  {conv.message_count !== undefined && (
                    <p className="text-xs text-gray-400">{conv.message_count} messages</p>
                  )}
                </button>
              );
            })}
            {conversations?.data?.length === 0 && (
              <p className="p-4 text-sm text-gray-500 text-center">No conversations yet</p>
            )}
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedConv ? (
            <>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {selectedConvData?.convo_type?.charAt(0).toUpperCase() ?? 'D'}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedConvData?.convo_type === 'dm' ? 'Direct Message' : `${selectedConvData?.convo_type} chat`}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <PresenceDot status="online" />
                    <span className="text-xs text-gray-400">Active</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages?.data?.map((msg) => (
                  <div key={msg.message_id} className="flex gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-medium">
                      U
                    </div>
                    <div>
                      <div className="bg-gray-100 rounded-xl px-4 py-2 text-sm max-w-xs inline-block">
                        {typeof msg.body === 'object' && msg.body !== null && 'text' in msg.body
                          ? (msg.body as { text: string }).text
                          : JSON.stringify(msg.body)}
                      </div>
                      <p className="text-xs text-gray-400 mt-1 ml-1">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                {typingUsers.size > 0 && (
                  <div className="flex gap-3 items-center">
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex-shrink-0" />
                    <div className="bg-gray-100 rounded-xl px-4 py-2 text-sm text-gray-400 italic">
                      typing...
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-gray-100 p-4 flex gap-2">
                <input
                  type="text"
                  value={text}
                  onChange={e => {
                    setText(e.target.value);
                    sendTyping();
                  }}
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
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <p className="text-4xl mb-3">✉</p>
                <p className="font-medium">Select a conversation</p>
                <p className="text-sm mt-1">Choose from the list on the left</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
