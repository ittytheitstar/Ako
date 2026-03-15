'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { GlossaryEntry } from '@ako/shared';

export default function AdminGlossaryPage() {
  const qc = useQueryClient();
  const [moduleId, setModuleId] = useState('');
  const [activeModuleId, setActiveModuleId] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);

  const pendingQuery = useQuery({
    queryKey: ['admin-glossary-pending', activeModuleId],
    queryFn: () => apiClient.getGlossaryEntries(activeModuleId, { status: 'pending' }),
    enabled: !!activeModuleId,
  });

  const categoriesQuery = useQuery({
    queryKey: ['admin-glossary-categories', activeModuleId],
    queryFn: () => apiClient.getGlossaryCategories(activeModuleId),
    enabled: !!activeModuleId,
  });

  const approveEntry = useMutation({
    mutationFn: (entryId: string) =>
      apiClient.updateGlossaryEntry(activeModuleId, entryId, { status: 'approved' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-glossary-pending', activeModuleId] }),
  });

  const rejectEntry = useMutation({
    mutationFn: (entryId: string) =>
      apiClient.updateGlossaryEntry(activeModuleId, entryId, { status: 'rejected' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-glossary-pending', activeModuleId] }),
  });

  const createCategory = useMutation({
    mutationFn: () => apiClient.createGlossaryCategory(activeModuleId, { name: newCategoryName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-glossary-categories', activeModuleId] });
      setNewCategoryName('');
      setShowAddCategory(false);
    },
  });

  const pending: GlossaryEntry[] = pendingQuery.data?.data ?? [];
  const categories = categoriesQuery.data?.data ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin — Glossary Moderation</h1>
        <p className="text-sm text-gray-500 mt-1">Review pending entries and manage categories</p>
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
          onClick={() => setActiveModuleId(moduleId)}
          disabled={!moduleId}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          Load
        </button>
      </div>

      {activeModuleId && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Pending Entries
                {pending.length > 0 && (
                  <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                    {pending.length}
                  </span>
                )}
              </h2>
            </div>

            {pendingQuery.isLoading ? (
              <p className="text-gray-500 text-sm">Loading…</p>
            ) : pending.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-white border border-gray-100 rounded-lg text-sm">
                No pending entries. 🎉
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                {pending.map((entry) => (
                  <div key={entry.entry_id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{entry.term}</span>
                          {entry.category_name && (
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{entry.category_name}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">{entry.definition}</p>
                        {entry.author_name && (
                          <p className="text-xs text-gray-400 mt-0.5">Submitted by {entry.author_name}</p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => approveEntry.mutate(entry.entry_id)}
                          disabled={approveEntry.isPending}
                          className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => rejectEntry.mutate(entry.entry_id)}
                          disabled={rejectEntry.isPending}
                          className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
              <button
                onClick={() => setShowAddCategory((v) => !v)}
                className="text-sm text-blue-600 hover:underline"
              >
                + Add
              </button>
            </div>

            {showAddCategory && (
              <div className="space-y-2">
                <input
                  type="text" value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => createCategory.mutate()}
                    disabled={!newCategoryName || createCategory.isPending}
                    className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {createCategory.isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setShowAddCategory(false)} className="text-xs text-gray-500">Cancel</button>
                </div>
              </div>
            )}

            {categoriesQuery.isLoading ? (
              <p className="text-gray-500 text-sm">Loading…</p>
            ) : categories.length === 0 ? (
              <p className="text-sm text-gray-400">No categories yet.</p>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                {categories.map((cat) => (
                  <div key={cat.category_id} className="px-4 py-2.5">
                    <span className="text-sm text-gray-800">{cat.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
