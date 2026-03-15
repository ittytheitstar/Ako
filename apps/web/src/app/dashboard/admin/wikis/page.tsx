'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { WikiPage, WikiPageVersion } from '@ako/shared';

export default function AdminWikisPage() {
  const qc = useQueryClient();
  const [moduleId, setModuleId] = useState('');
  const [activeModuleId, setActiveModuleId] = useState('');
  const [selectedPage, setSelectedPage] = useState<WikiPage | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const pagesQuery = useQuery({
    queryKey: ['admin-wiki-pages', activeModuleId],
    queryFn: () => apiClient.getWikiPages(activeModuleId),
    enabled: !!activeModuleId,
  });

  const historyQuery = useQuery({
    queryKey: ['admin-wiki-history', activeModuleId, selectedPage?.page_id],
    queryFn: () => apiClient.getWikiPageHistory(activeModuleId, selectedPage!.page_id),
    enabled: showHistory && !!selectedPage,
  });

  const lockPage = useMutation({
    mutationFn: ({ pageId, locked }: { pageId: string; locked: boolean }) =>
      apiClient.lockWikiPage(activeModuleId, pageId, locked),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin-wiki-pages', activeModuleId] });
      if (selectedPage?.page_id === data.page_id) setSelectedPage(data);
    },
  });

  const revertPage = useMutation({
    mutationFn: ({ pageId, versionId }: { pageId: string; versionId: string }) =>
      apiClient.revertWikiPage(activeModuleId, pageId, versionId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin-wiki-pages', activeModuleId] });
      setSelectedPage(data);
      setShowHistory(false);
    },
  });

  const pages: WikiPage[] = pagesQuery.data?.data ?? [];
  const history: WikiPageVersion[] = historyQuery.data?.data ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin — Wiki Management</h1>
        <p className="text-sm text-gray-500 mt-1">View, lock, and manage wiki pages</p>
      </div>

      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Module ID</label>
          <input
            type="text" value={moduleId} onChange={(e) => setModuleId(e.target.value)}
            placeholder="Enter module ID…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={() => { setActiveModuleId(moduleId); setSelectedPage(null); setShowHistory(false); }}
          disabled={!moduleId}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          Load
        </button>
      </div>

      {pagesQuery.isLoading && <p className="text-gray-500 text-sm">Loading…</p>}
      {pagesQuery.isError && <p className="text-red-600 text-sm">Failed to load wiki pages.</p>}

      {activeModuleId && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1 space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Pages ({pages.length})</p>
            {pages.length === 0 && !pagesQuery.isLoading && (
              <p className="text-sm text-gray-400">No pages yet.</p>
            )}
            {pages.map((page) => (
              <button
                key={page.page_id}
                onClick={() => { setSelectedPage(page); setShowHistory(false); }}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg flex items-center gap-1 ${
                  selectedPage?.page_id === page.page_id
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {page.locked && <span title="Locked">🔒</span>}
                <span className="truncate">{page.title}</span>
                <span className="ml-auto text-xs text-gray-400">v{page.version}</span>
              </button>
            ))}
          </div>

          <div className="col-span-2">
            {!selectedPage ? (
              <div className="flex items-center justify-center h-64 text-gray-400 bg-white border border-gray-100 rounded-lg">
                Select a page to manage
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{selectedPage.title}</h2>
                    <p className="text-xs text-gray-400 mt-1">
                      v{selectedPage.version} · {new Date(selectedPage.updated_at).toLocaleString()}
                      {selectedPage.owner_name && ` · ${selectedPage.owner_name}`}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => lockPage.mutate({ pageId: selectedPage.page_id, locked: !selectedPage.locked })}
                      disabled={lockPage.isPending}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 ${
                        selectedPage.locked
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {selectedPage.locked ? '🔓 Unlock' : '🔒 Lock'}
                    </button>
                    <button
                      onClick={() => setShowHistory((v) => !v)}
                      className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200"
                    >
                      History
                    </button>
                  </div>
                </div>

                {selectedPage.locked && (
                  <div className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded px-3 py-1.5">
                    🔒 This page is locked. Users cannot edit it.
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs text-gray-700 max-h-48 overflow-auto">
                  {JSON.stringify(selectedPage.body, null, 2)}
                </div>

                {showHistory && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-700">Version History</p>
                    {historyQuery.isLoading ? (
                      <p className="text-sm text-gray-500">Loading…</p>
                    ) : history.length === 0 ? (
                      <p className="text-sm text-gray-400">No history available.</p>
                    ) : (
                      <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                        {history.map((v) => (
                          <div key={v.version_id} className="flex items-center justify-between px-4 py-2.5">
                            <div>
                              <span className="text-sm font-medium text-gray-800">v{v.version}</span>
                              {v.editor_name && <span className="text-xs text-gray-500 ml-2">by {v.editor_name}</span>}
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-xs text-gray-400">{new Date(v.created_at).toLocaleString()}</span>
                              <button
                                onClick={() => revertPage.mutate({ pageId: selectedPage.page_id, versionId: v.version_id })}
                                disabled={revertPage.isPending}
                                className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                              >
                                Revert
                              </button>
                            </div>
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
      )}
    </div>
  );
}
