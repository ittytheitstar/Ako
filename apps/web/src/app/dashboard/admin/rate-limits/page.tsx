'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import type { RateLimitConfig } from '@ako/shared';

export default function RateLimitsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    route_pattern: '',
    window_seconds: 60,
    max_requests: 200,
    max_write_requests: '',
    burst_multiplier: 1.5,
    scope: 'tenant' as RateLimitConfig['scope'],
    notes: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['rate-limits'],
    queryFn: () => apiClient.getRateLimitConfigs(),
  });

  const resetForm = () => {
    setForm({ route_pattern: '', window_seconds: 60, max_requests: 200, max_write_requests: '', burst_multiplier: 1.5, scope: 'tenant', notes: '' });
    setEditId(null);
    setShowForm(false);
    setError(null);
  };

  const createMutation = useMutation({
    mutationFn: (d: Partial<RateLimitConfig>) => apiClient.createRateLimitConfig(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rate-limits'] }); resetForm(); },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<RateLimitConfig> }) => apiClient.updateRateLimitConfig(id, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rate-limits'] }); resetForm(); },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteRateLimitConfig(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rate-limits'] }),
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<RateLimitConfig> = {
      route_pattern: form.route_pattern || undefined,
      window_seconds: form.window_seconds,
      max_requests: form.max_requests,
      max_write_requests: form.max_write_requests !== '' ? Number(form.max_write_requests) : undefined,
      burst_multiplier: form.burst_multiplier,
      scope: form.scope,
      notes: form.notes || undefined,
    };
    if (editId) {
      updateMutation.mutate({ id: editId, d: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const startEdit = (cfg: RateLimitConfig) => {
    setForm({
      route_pattern: cfg.route_pattern ?? '',
      window_seconds: cfg.window_seconds,
      max_requests: cfg.max_requests,
      max_write_requests: cfg.max_write_requests ? String(cfg.max_write_requests) : '',
      burst_multiplier: cfg.burst_multiplier,
      scope: cfg.scope,
      notes: cfg.notes ?? '',
    });
    setEditId(cfg.config_id);
    setShowForm(true);
  };

  const scopeBadge = (s: RateLimitConfig['scope']) => {
    const map: Record<string, string> = {
      global: 'bg-purple-100 text-purple-700',
      tenant: 'bg-blue-100 text-blue-700',
      api_key: 'bg-orange-100 text-orange-700',
    };
    return map[s] ?? 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rate Limit Configuration</h1>
          <p className="text-sm text-gray-500 mt-1">Manage per-tenant and per-route request limits</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin" className="text-sm text-blue-600 hover:underline">← Admin</Link>
          <button
            onClick={() => { setShowForm(!showForm); setEditId(null); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Add Rule
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">{editId ? 'Edit Rule' : 'New Rate Limit Rule'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Route Pattern</label>
              <input
                type="text"
                placeholder="e.g. /api/v1/exports (leave blank for all routes)"
                value={form.route_pattern}
                onChange={e => setForm(f => ({ ...f, route_pattern: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
              <select
                value={form.scope}
                onChange={e => setForm(f => ({ ...f, scope: e.target.value as RateLimitConfig['scope'] }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="tenant">Tenant</option>
                <option value="api_key">API Key</option>
                <option value="global">Global</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Window (seconds)</label>
              <input
                type="number"
                min={1}
                max={3600}
                value={form.window_seconds}
                onChange={e => setForm(f => ({ ...f, window_seconds: Number(e.target.value) }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Requests</label>
              <input
                type="number"
                min={1}
                value={form.max_requests}
                onChange={e => setForm(f => ({ ...f, max_requests: Number(e.target.value) }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Write Requests (optional)</label>
              <input
                type="number"
                min={1}
                placeholder="Same as max requests"
                value={form.max_write_requests}
                onChange={e => setForm(f => ({ ...f, max_write_requests: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Burst Multiplier</label>
              <input
                type="number"
                step={0.1}
                min={1}
                max={10}
                value={form.burst_multiplier}
                onChange={e => setForm(f => ({ ...f, burst_multiplier: Number(e.target.value) }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              {editId ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={resetForm} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading && <p className="text-gray-500">Loading…</p>}
      {data && data.data.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg font-medium">No rate limit rules configured</p>
          <p className="text-sm mt-1">The platform defaults apply. Add rules to customise per-tenant or per-route limits.</p>
        </div>
      )}
      {data && data.data.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Route', 'Scope', 'Window', 'Max Req', 'Burst ×', 'Notes', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((cfg: RateLimitConfig) => (
                <tr key={cfg.config_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{cfg.route_pattern ?? <span className="text-gray-400 italic">all routes</span>}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${scopeBadge(cfg.scope)}`}>{cfg.scope}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{cfg.window_seconds}s</td>
                  <td className="px-4 py-3 text-gray-600">{cfg.max_requests}{cfg.max_write_requests ? ` / ${cfg.max_write_requests}w` : ''}</td>
                  <td className="px-4 py-3 text-gray-600">{cfg.burst_multiplier}×</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{cfg.notes ?? '—'}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => startEdit(cfg)} className="text-blue-600 hover:underline text-xs">Edit</button>
                    <button
                      onClick={() => { if (confirm('Delete this rule?')) deleteMutation.mutate(cfg.config_id); }}
                      className="text-red-500 hover:underline text-xs"
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
