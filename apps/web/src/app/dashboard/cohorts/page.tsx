'use client';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

export default function CohortsPage() {
  const queryClient = useQueryClient();
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: cohorts, isLoading } = useQuery({
    queryKey: ['cohorts'],
    queryFn: () => apiClient.getCohorts(),
  });

  const createMutation = useMutation({
    mutationFn: () => apiClient.createCohort({ code: newCode, name: newName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cohorts'] });
      setNewCode('');
      setNewName('');
      setShowCreateForm(false);
      setCreateError('');
    },
    onError: (e: Error) => setCreateError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteCohort(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cohorts'] }),
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cohorts</h1>
          <p className="text-gray-500 mt-1">Manage student cohorts and their members</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          + New Cohort
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Create Cohort</h3>
          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              value={newCode}
              onChange={e => setNewCode(e.target.value)}
              placeholder="Code (e.g. 2024-T1)"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Name (e.g. Semester 1 2024)"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-64"
            />
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !newCode.trim() || !newName.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm transition-colors"
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </button>
            <button
              onClick={() => { setShowCreateForm(false); setCreateError(''); }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
          {createError && <p className="text-xs text-red-600 mt-2">{createError}</p>}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200">
          {cohorts?.data?.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No cohorts yet. Create your first cohort above.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {cohorts?.data?.map(cohort => (
                <div key={cohort.cohort_id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                  <Link href={`/dashboard/cohorts/${cohort.cohort_id}`} className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-sm">{cohort.code.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{cohort.name}</p>
                        <p className="text-sm text-gray-500">{cohort.code}</p>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-4">
                    <Link
                      href={`/dashboard/cohorts/${cohort.cohort_id}`}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Manage →
                    </Link>
                    <button
                      onClick={() => {
                        if (confirm(`Delete cohort "${cohort.name}"?`)) {
                          deleteMutation.mutate(cohort.cohort_id);
                        }
                      }}
                      className="text-sm text-red-500 hover:text-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
