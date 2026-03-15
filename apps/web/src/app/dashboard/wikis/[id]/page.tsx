'use client';
import React, { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { WikiPage, WikiPageVersion } from '@ako/shared';

export default function WikiPage_({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();

  const [selectedPage, setSelectedPage] = useState<WikiPage | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showNewPage, setShowNewPage] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');

  const pagesQuery = useQuery({
    queryKey: ['wiki-pages', id],
    queryFn: () => apiClient.getWikiPages(id),
  });

  const historyQuery = useQuery({
    queryKey: ['wiki-page-history', id, selectedPage?.page_id],
    queryFn: () => apiClient.getWikiPageHistory(id, selectedPage!.page_id),
    enabled: showHistory && !!selectedPage,
  });

  const createPage = useMutation({
    mutationFn: () => {
      let body: Record<string, unknown> = {};
      try { body = JSON.parse(newBody || '{}'); } catch { /* ignore */ }
      return apiClient.createWikiPage(id, { title: newTitle, body });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['wiki-pages', id] });
      setShowNewPage(false);
      setNewTitle('');
      setNewBody('');
      setSelectedPage(data);
    },
  });

  const updatePage = useMutation({
    mutationFn: () => {
      let body: Record<string, unknown> = {};
      try { body = JSON.parse(editBody); } catch { /* ignore */ }
      return apiClient.updateWikiPage(id, selectedPage!.page_id, { title: editTitle, body });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['wiki-pages', id] });
      setSelectedPage(data);
      setEditMode(false);
    },
  });

  const pages: WikiPage[] = pagesQuery.data?.data ?? [];
  const history: WikiPageVersion[] = historyQuery.data?.data ?? [];

  const openPage = (page: WikiPage) => {
    setSelectedPage(page);
    setEditMode(false);
    setShowHistory(false);
  };

  const startEdit = () => {
    setEditTitle(selectedPage!.title);
    setEditBody(JSON.stringify(selectedPage!.body, null, 2));
    setEditMode(true);
    setShowHistory(false);
  };

  if (pagesQuery.isLoading) return <div className="p-6 text-gray-500">Loading…</div>;
  if (pagesQuery.isError) return <div className="p-6 text-red-600">Failed to load wiki.</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Wiki</h1>
        <button
          onClick={() => setShowNewPage((v) => !v)}
          className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
        >
          + New Page
        </button>
      </div>

      {showNewPage && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">New Wiki Page</p>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Page title"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <div>
            <label className="block text-xs text-gray-600 mb-1">Body (JSON)</label>
            <textarea
              rows={4}
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder='{"content": "Page content..."}'
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createPage.mutate()}
              disabled={!newTitle || createPage.isPending}
              className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {createPage.isPending ? 'Creating…' : 'Create Page'}
            </button>
            <button onClick={() => setShowNewPage(false)} className="text-sm text-gray-500 px-3 py-2">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-1 space-y-1">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Pages</p>
          {pages.length === 0 && (
            <p className="text-sm text-gray-400">No pages yet.</p>
          )}
          {pages.map((page) => (
            <button
              key={page.page_id}
              onClick={() => openPage(page)}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg flex items-center gap-1 ${
                selectedPage?.page_id === page.page_id
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {page.locked && <span title="Locked" className="text-xs">🔒</span>}
              <span className="truncate">{page.title}</span>
            </button>
          ))}
        </div>

        <div className="col-span-3">
          {!selectedPage ? (
            <div className="flex items-center justify-center h-64 text-gray-400 bg-white border border-gray-100 rounded-lg">
              Select a page to view
            </div>
          ) : editMode ? (
            <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg font-semibold"
              />
              <div>
                <label className="block text-xs text-gray-600 mb-1">Body (JSON)</label>
                <textarea
                  rows={10}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => updatePage.mutate()}
                  disabled={!editTitle || updatePage.isPending}
                  className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {updatePage.isPending ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditMode(false)} className="text-sm text-gray-500 px-3 py-2">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{selectedPage.title}</h2>
                  <p className="text-xs text-gray-400 mt-1">
                    v{selectedPage.version} · Updated {new Date(selectedPage.updated_at).toLocaleDateString()}
                    {selectedPage.owner_name && ` · by ${selectedPage.owner_name}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!selectedPage.locked && (
                    <button onClick={startEdit} className="text-xs text-blue-600 hover:underline">Edit</button>
                  )}
                  <button
                    onClick={() => setShowHistory((v) => !v)}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    History
                  </button>
                </div>
              </div>

              {selectedPage.locked && (
                <div className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded px-3 py-1.5">
                  🔒 This page is locked and cannot be edited.
                </div>
              )}

              <div className="prose prose-sm max-w-none text-gray-700 bg-gray-50 rounded-lg p-4 font-mono text-xs">
                {JSON.stringify(selectedPage.body, null, 2)}
              </div>

              {showHistory && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Version History</p>
                  {historyQuery.isLoading ? (
                    <p className="text-gray-500 text-sm">Loading…</p>
                  ) : history.length === 0 ? (
                    <p className="text-sm text-gray-400">No history available.</p>
                  ) : (
                    <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                      {history.map((v) => (
                        <div key={v.version_id} className="flex items-center justify-between px-4 py-2">
                          <div>
                            <span className="text-sm text-gray-800 font-medium">v{v.version}</span>
                            {v.editor_name && <span className="text-xs text-gray-500 ml-2">by {v.editor_name}</span>}
                          </div>
                          <span className="text-xs text-gray-400">{new Date(v.created_at).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
