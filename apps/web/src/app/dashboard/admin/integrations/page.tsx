'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import type { IntegrationConnector } from '@ako/shared';

export default function AdminIntegrationsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [healthResults, setHealthResults] = useState<Record<string, { health_status: string; latency_ms: number | null; error_message: string | null }>>({});
  const [form, setForm] = useState({
    name: '',
    connector_type: 'sis' as IntegrationConnector['connector_type'],
    health_url: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => apiClient.getIntegrations(),
  });

  const createMutation = useMutation({
    mutationFn: (d: { name: string; connector_type: string; settings?: Record<string, unknown> }) =>
      apiClient.createIntegration(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setShowCreate(false);
      setForm({ name: '', connector_type: 'sis', health_url: '' });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteIntegration(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integrations'] }),
    onError: (e: Error) => setError(e.message),
  });

  const checkHealth = async (id: string) => {
    try {
      const result = await apiClient.getIntegrationHealth(id);
      setHealthResults(prev => ({
        ...prev,
        [id]: { health_status: result.health_status, latency_ms: result.latency_ms, error_message: result.error_message },
      }));
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    } catch (e) {
      setError(String(e));
    }
  };

  const healthBadge = (status: string) => {
    const map: Record<string, string> = {
      healthy: 'bg-green-100 text-green-700',
      degraded: 'bg-yellow-100 text-yellow-700',
      unhealthy: 'bg-red-100 text-red-700',
      unknown: 'bg-gray-100 text-gray-600',
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  };

  const typeIcons: Record<string, string> = {
    sis: '🏫',
    sms: '📱',
    identity: '🔑',
    assessment: '📝',
    content: '📚',
    analytics: '📊',
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Link href="/dashboard" className="hover:text-blue-600">Dashboard</Link>
          <span>›</span>
          <span className="text-gray-900">Integration Hub</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Integration Hub</h1>
            <p className="text-gray-500 mt-1">Manage external system integrations and monitor their health.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            + Add Integration
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
          <h2 className="font-semibold text-gray-900 mb-4">Add Integration Connector</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.connector_type}
                onChange={e => setForm(f => ({ ...f, connector_type: e.target.value as IntegrationConnector['connector_type'] }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="sis">SIS / Student Information System</option>
                <option value="sms">SMS / School Management System</option>
                <option value="identity">Identity Provider</option>
                <option value="assessment">Assessment Tool</option>
                <option value="content">Content Repository</option>
                <option value="analytics">Analytics Platform</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Health Check URL (optional)</label>
              <input
                type="url"
                value={form.health_url}
                onChange={e => setForm(f => ({ ...f, health_url: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://external-system/health"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => createMutation.mutate({
                name: form.name,
                connector_type: form.connector_type,
                settings: form.health_url ? { health_url: form.health_url } : {},
              })}
              disabled={!form.name || createMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Adding…' : 'Add Connector'}
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
          <div className="text-4xl mb-3">🔌</div>
          <p className="text-gray-500">No integrations configured. Click <strong>+ Add Integration</strong> to connect an external system.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.data.map((connector) => {
            const hr = healthResults[connector.connector_id];
            const displayStatus = hr?.health_status ?? connector.health_status;
            return (
              <div key={connector.connector_id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start gap-4">
                  <div className="text-2xl mt-0.5">{typeIcons[connector.connector_type] ?? '🔌'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{connector.name}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${healthBadge(displayStatus)}`}>
                        {displayStatus === 'healthy' ? '✓' : displayStatus === 'unhealthy' ? '✗' : '~'} {displayStatus}
                      </span>
                      <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded capitalize">{connector.connector_type}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      {(hr?.latency_ms ?? connector.latency_ms) != null && (
                        <span>Latency: {hr?.latency_ms ?? connector.latency_ms}ms</span>
                      )}
                      {connector.last_health_check && (
                        <span>Last check: {new Date(connector.last_health_check).toLocaleString()}</span>
                      )}
                    </div>
                    {(hr?.error_message ?? connector.error_message) && (
                      <p className="text-xs text-red-600 mt-1">{hr?.error_message ?? connector.error_message}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => checkHealth(connector.connector_id)}
                      className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                    >
                      Check Health
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remove "${connector.name}"?`)) {
                          deleteMutation.mutate(connector.connector_id);
                        }
                      }}
                      className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
