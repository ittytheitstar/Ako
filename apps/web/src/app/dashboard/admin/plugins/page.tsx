'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import type { Plugin } from '@ako/shared';

export default function AdminPluginsPage() {
  const queryClient = useQueryClient();
  const [showInstall, setShowInstall] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    plugin_type: 'ui' as Plugin['plugin_type'],
    author: '',
    homepage_url: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: () => apiClient.getPlugins(),
  });

  const installMutation = useMutation({
    mutationFn: (d: Partial<Plugin>) => apiClient.installPlugin(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugins'] });
      setShowInstall(false);
      setForm({ name: '', description: '', plugin_type: 'ui', author: '', homepage_url: '' });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const enableMutation = useMutation({
    mutationFn: (id: string) => apiClient.enablePlugin(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plugins'] }),
    onError: (e: Error) => setError(e.message),
  });

  const disableMutation = useMutation({
    mutationFn: (id: string) => apiClient.disablePlugin(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plugins'] }),
    onError: (e: Error) => setError(e.message),
  });

  const uninstallMutation = useMutation({
    mutationFn: (id: string) => apiClient.uninstallPlugin(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plugins'] }),
    onError: (e: Error) => setError(e.message),
  });

  const statusBadge = (status: Plugin['status']) => {
    const map: Record<string, string> = {
      enabled: 'bg-green-100 text-green-700',
      disabled: 'bg-gray-100 text-gray-600',
      error: 'bg-red-100 text-red-700',
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  };

  const typeIcon: Record<Plugin['plugin_type'], string> = {
    ui: '🎨',
    backend: '⚙️',
    automation: '🤖',
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Link href="/dashboard" className="hover:text-blue-600">Dashboard</Link>
          <span>›</span>
          <span className="text-gray-900">Plugin Management</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Plugin Management</h1>
            <p className="text-gray-500 mt-1">Install, enable, and manage platform extensions.</p>
          </div>
          <button
            onClick={() => setShowInstall(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            + Install Plugin
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="underline">Dismiss</button>
        </div>
      )}

      {/* Install form */}
      {showInstall && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Register New Plugin</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="my-plugin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.plugin_type}
                onChange={e => setForm(f => ({ ...f, plugin_type: e.target.value as Plugin['plugin_type'] }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ui">UI (course tools, blocks)</option>
                <option value="backend">Backend (enrolment, rules)</option>
                <option value="automation">Automation (triggers, workflows)</option>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
              <input
                type="text"
                value={form.author}
                onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Homepage URL</label>
              <input
                type="url"
                value={form.homepage_url}
                onChange={e => setForm(f => ({ ...f, homepage_url: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => installMutation.mutate(form)}
              disabled={!form.name || installMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {installMutation.isPending ? 'Installing…' : 'Install Plugin'}
            </button>
            <button
              onClick={() => setShowInstall(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Plugin list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      ) : !data?.data?.length ? (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-12 text-center">
          <div className="text-4xl mb-3">🧩</div>
          <p className="text-gray-500">No plugins installed. Click <strong>+ Install Plugin</strong> to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.data.map((plugin) => (
            <div key={plugin.plugin_id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
              <div className="text-2xl mt-0.5">{typeIcon[plugin.plugin_type]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{plugin.name}</h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(plugin.status)}`}>
                    {plugin.status}
                  </span>
                  <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">{plugin.plugin_type}</span>
                  {(plugin as Plugin & { current_version?: string }).current_version && (
                    <span className="text-xs text-blue-600">v{(plugin as Plugin & { current_version?: string }).current_version}</span>
                  )}
                </div>
                {plugin.description && <p className="text-sm text-gray-500">{plugin.description}</p>}
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  {plugin.author && <span>By {plugin.author}</span>}
                  {plugin.permission_scopes.length > 0 && (
                    <span>Scopes: {plugin.permission_scopes.join(', ')}</span>
                  )}
                  <span>API v{plugin.api_version}</span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {plugin.status === 'disabled' || plugin.status === 'error' ? (
                  <button
                    onClick={() => enableMutation.mutate(plugin.plugin_id)}
                    disabled={enableMutation.isPending}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Enable
                  </button>
                ) : (
                  <button
                    onClick={() => disableMutation.mutate(plugin.plugin_id)}
                    disabled={disableMutation.isPending}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    Disable
                  </button>
                )}
                <button
                  onClick={() => {
                    if (confirm(`Uninstall "${plugin.name}"? This cannot be undone.`)) {
                      uninstallMutation.mutate(plugin.plugin_id);
                    }
                  }}
                  disabled={uninstallMutation.isPending}
                  className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
                >
                  Uninstall
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
