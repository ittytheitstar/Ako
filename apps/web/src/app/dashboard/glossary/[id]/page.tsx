'use client';
import React, { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { GlossaryEntry } from '@ako/shared';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function GlossaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();

  const [letterFilter, setLetterFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('approved');
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newTerm, setNewTerm] = useState('');
  const [newDef, setNewDef] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');

  const entriesQuery = useQuery({
    queryKey: ['glossary-entries', id, statusFilter, letterFilter],
    queryFn: () =>
      apiClient.getGlossaryEntries(id, {
        status: (statusFilter as 'approved' | 'pending' | 'rejected') || undefined,
        letter: letterFilter || undefined,
      }),
  });

  const categoriesQuery = useQuery({
    queryKey: ['glossary-categories', id],
    queryFn: () => apiClient.getGlossaryCategories(id),
  });

  const createEntry = useMutation({
    mutationFn: () =>
      apiClient.createGlossaryEntry(id, {
        term: newTerm,
        definition: newDef,
        category_id: newCategoryId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['glossary-entries', id] });
      setNewTerm('');
      setNewDef('');
      setNewCategoryId('');
      setShowNewEntry(false);
    },
  });

  const entries: GlossaryEntry[] = entriesQuery.data?.data ?? [];
  const categories = categoriesQuery.data?.data ?? [];

  const filtered = letterFilter
    ? entries.filter((e) => e.term.toUpperCase().startsWith(letterFilter))
    : entries;

  if (entriesQuery.isLoading) return <div className="p-6 text-gray-500">Loading…</div>;
  if (entriesQuery.isError) return <div className="p-6 text-red-600">Failed to load glossary.</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Glossary</h1>
          <p className="text-sm text-gray-500 mt-1">{entries.length} entries</p>
        </div>
        <button
          onClick={() => setShowNewEntry((v) => !v)}
          className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
        >
          + Add Entry
        </button>
      </div>

      {showNewEntry && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">New Glossary Entry</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Term</label>
              <input
                type="text"
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                placeholder="Term"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Category (optional)</label>
              <select
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.category_id} value={c.category_id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Definition</label>
            <textarea
              rows={3}
              value={newDef}
              onChange={(e) => setNewDef(e.target.value)}
              placeholder="Definition"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createEntry.mutate()}
              disabled={!newTerm || !newDef || createEntry.isPending}
              className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {createEntry.isPending ? 'Saving…' : 'Submit Entry'}
            </button>
            <button onClick={() => setShowNewEntry(false)} className="text-sm text-gray-500 px-3 py-2">Cancel</button>
          </div>
          <p className="text-xs text-gray-400">Your entry will be reviewed before appearing publicly.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => setLetterFilter('')}
          className={`text-xs px-2.5 py-1 rounded-full font-medium ${!letterFilter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          All
        </button>
        {ALPHABET.map((l) => (
          <button
            key={l}
            onClick={() => setLetterFilter(l === letterFilter ? '' : l)}
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${letterFilter === l ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {l}
          </button>
        ))}
        <div className="ml-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="">All</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white border border-gray-100 rounded-lg">
          No entries found.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {filtered.map((entry) => (
            <div key={entry.entry_id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{entry.term}</span>
                    {entry.category_name && (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{entry.category_name}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{entry.definition}</p>
                  {entry.author_name && (
                    <p className="text-xs text-gray-400 mt-1">by {entry.author_name}</p>
                  )}
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                  entry.status === 'approved' ? 'bg-green-100 text-green-700' :
                  entry.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {entry.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
