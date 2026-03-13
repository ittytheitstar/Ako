'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import type { FeatureFlag } from '@ako/shared';

export default function AdminFeatureFlagsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    enabled: false,
    rollout_pct: 100,
    context: 'global' as FeatureFlag['context'],
  });

  const { data, isLoading } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => apiClient.getFeatureFlags(),
  });

  const createMutation = useMutation({
    mutationFn: (d: Partial<FeatureFlag>) => apiClient.createFeatureFlag(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      setShowCreate(false);
      setForm({ name: '', description: '', enabled: false, rollout_pct: 100, context: 'global' });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiClient.updateFeatureFlag(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feature-flags'] }),
    onError: (e: Error) => setError(e.message),
  });

  const updateRolloutMutation = useMutation({
    mutationFn: ({ id, rollout_pct }: { id: string; rollout_pct: number }) =>
      apiClient.updateFeatureFlag(id, { rollout_pct }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feature-flags'] }),
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteFeatureFlag(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feature-flags'] }),
    onError: (e: Error) => setError(e.message),
  });

  const contextBadge = (ctx: string) => {
    const map: Record<string, string> = {
      global: 'bg-purple-100 text-purple-700',
      tenant: 'bg-blue-100 text-blue-700',
      course: 'bg-orange-100 text-orange-700',
    };
    return map[ctx] ?? 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Link href="/dashboard" className="hover:text-blue-600">Dashboard</Link>
          <span>›</span>
          <span className="text-gray-900">Feature Flags</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
            <p className="text-gray-500 mt-1">Control progressive rollout and experimental features.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            + New Flag
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="underline">Dismiss</button>
        </div>
      )}

      {showCreate && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Create Feature Flag</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Flag Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="feature-x"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Context</label>
              <select
                value={form.context}
                onChange={e => setForm(f => ({ ...f, context: e.target.value as FeatureFlag['context'] }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="global">Global</option>
                <option value="tenant">Tenant</option>
                <option value="course">Course</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rollout %</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={form.rollout_pct}
                  onChange={e => setForm(f => ({ ...f, rollout_pct: parseInt(e.target.value) }))}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-10 text-right">{form.rollout_pct}%</span>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-5">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ml-3 text-sm font-medium text-gray-700">
                  {form.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name || createMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating…' : 'Create Flag'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      ) : !data?.data?.length ? (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-12 text-center">
          <div className="text-4xl mb-3">🚩</div>
          <p className="text-gray-500">No feature flags defined. Create one to control progressive rollouts.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Flag</th>
                <th className="px-6 py-3 text-left">Context</th>
                <th className="px-6 py-3 text-center">Rollout</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((flag) => (
                <tr key={flag.flag_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900 font-mono text-sm">{flag.name}</div>
                    {flag.description && <div className="text-xs text-gray-500 mt-0.5">{flag.description}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${contextBadge(flag.context)}`}>
                      {flag.context}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-20 bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full"
                          style={{ width: `${flag.rollout_pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 font-mono">{flag.rollout_pct}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      defaultValue={flag.rollout_pct}
                      onMouseUp={e => updateRolloutMutation.mutate({ id: flag.flag_id, rollout_pct: parseInt((e.target as HTMLInputElement).value) })}
                      className="w-24 mt-1 h-1 accent-blue-600"
                    />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => toggleMutation.mutate({ id: flag.flag_id, enabled: !flag.enabled })}
                      disabled={toggleMutation.isPending}
                      className="relative inline-flex items-center cursor-pointer"
                      title={flag.enabled ? 'Click to disable' : 'Click to enable'}
                    >
                      <div className={`w-11 h-6 rounded-full transition-colors ${flag.enabled ? 'bg-blue-600' : 'bg-gray-200'}`}>
                        <div className={`absolute top-[2px] left-[2px] bg-white border-gray-300 border rounded-full h-5 w-5 transition-transform ${flag.enabled ? 'translate-x-5' : ''}`} />
                      </div>
                      <span className="sr-only">{flag.enabled ? 'enabled' : 'disabled'}</span>
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Delete flag "${flag.name}"?`)) {
                          deleteMutation.mutate(flag.flag_id);
                        }
                      }}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
