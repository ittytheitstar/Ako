'use client';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import type { SystemAlert, SystemAlertEvent } from '@ako/shared';

export default function ObservabilityDashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts'>('overview');

  const summaryQuery = useQuery({
    queryKey: ['metrics-summary'],
    queryFn: () => apiClient.getMetricsSummary(),
    refetchInterval: 30000,
  });

  const alertsQuery = useQuery({
    queryKey: ['system-alerts'],
    queryFn: () => apiClient.getSystemAlerts(),
    enabled: activeTab === 'alerts',
  });

  const triggeredQuery = useQuery({
    queryKey: ['triggered-alerts'],
    queryFn: () => apiClient.getTriggeredAlerts(20),
    enabled: activeTab === 'alerts',
  });

  const healthQuery = useQuery({
    queryKey: ['health-ready'],
    queryFn: () => apiClient.getHealthReady(),
    refetchInterval: 15000,
  });

  const summary = summaryQuery.data;
  const health = healthQuery.data;

  const severityColour = (s: SystemAlert['severity']) => {
    if (s === 'critical') return 'bg-red-100 text-red-700';
    if (s === 'warning') return 'bg-yellow-100 text-yellow-700';
    return 'bg-blue-100 text-blue-700';
  };

  const statusColour = (s: SystemAlertEvent['status']) =>
    s === 'triggered' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700';

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Observability</h1>
          <p className="text-sm text-gray-500 mt-1">Platform metrics, health and alert rules</p>
        </div>
        <Link href="/dashboard/admin" className="text-sm text-blue-600 hover:underline">
          ← Admin
        </Link>
      </div>

      {/* Health summary bar */}
      {health && (
        <div className={`rounded-lg p-4 flex items-center gap-3 ${health.status === 'ok' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <span className={`w-3 h-3 rounded-full ${health.status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="font-medium text-gray-800">
            System {health.status === 'ok' ? 'Healthy' : 'Degraded'}
          </span>
          {health.checks && Object.entries(health.checks as Record<string, { status: string; latency_ms?: number }>).map(([svc, info]) => (
            <span key={svc} className={`ml-2 text-xs px-2 py-0.5 rounded-full ${info.status === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {svc}: {info.status}{info.latency_ms !== undefined ? ` (${info.latency_ms}ms)` : ''}
            </span>
          ))}
          <span className="ml-auto text-xs text-gray-400">{health.timestamp}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {(['overview', 'alerts'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 text-sm font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {summaryQuery.isLoading && <p className="text-gray-500">Loading metrics…</p>}
          {summary && (
            <>
              {/* HTTP metrics */}
              <section>
                <h2 className="text-lg font-semibold text-gray-800 mb-3">HTTP Traffic</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard label="Total Requests" value={summary.http.requests_total.toLocaleString()} />
                  <MetricCard label="Error Rate" value={`${summary.http.error_rate_pct}%`} accent={summary.http.error_rate_pct > 5 ? 'red' : 'green'} />
                  <MetricCard label="p95 Latency" value={`${summary.http.latency_ms.p95}ms`} accent={summary.http.latency_ms.p95 > 500 ? 'yellow' : 'green'} />
                  <MetricCard label="p99 Latency" value={`${summary.http.latency_ms.p99}ms`} accent={summary.http.latency_ms.p99 > 1000 ? 'red' : 'green'} />
                </div>
              </section>

              {/* Database metrics */}
              <section>
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Database</h2>
                <div className="grid grid-cols-2 gap-4">
                  <MetricCard label="Active Connections" value={String(summary.database.pool_active_connections)} />
                  <MetricCard label="DB Ping" value={`${summary.database.ping_ms}ms`} accent={summary.database.ping_ms > 100 ? 'yellow' : 'green'} />
                </div>
              </section>

              {/* Process metrics */}
              <section>
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Process</h2>
                <div className="grid grid-cols-2 gap-4">
                  <MetricCard label="Uptime" value={formatUptime(summary.process.uptime_seconds)} />
                  <MetricCard label="Memory" value={`${summary.process.memory_mb} MB`} accent={summary.process.memory_mb > 512 ? 'yellow' : 'green'} />
                </div>
              </section>

              <p className="text-xs text-gray-400">Collected at {summary.collected_at} · refreshes every 30s</p>
            </>
          )}
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-6">
          {/* Alert rules */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Alert Rules</h2>
            {alertsQuery.isLoading && <p className="text-gray-500">Loading…</p>}
            {alertsQuery.data && alertsQuery.data.data.length === 0 && (
              <p className="text-gray-400 text-sm">No alert rules configured. Use the &quot;+ Add Alert&quot; button in System Alerts to add rules.</p>
            )}
            {alertsQuery.data && alertsQuery.data.data.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Name', 'Metric', 'Threshold', 'Severity', 'Status', 'Triggers'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {alertsQuery.data.data.map((a: SystemAlert) => (
                      <tr key={a.alert_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{a.metric_name}</td>
                        <td className="px-4 py-3 text-gray-600">{a.comparison} {a.threshold_value}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityColour(a.severity)}`}>
                            {a.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${a.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {a.active ? 'active' : 'disabled'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{a.trigger_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Recent triggered alerts */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Recent Events</h2>
            {triggeredQuery.isLoading && <p className="text-gray-500">Loading…</p>}
            {triggeredQuery.data && triggeredQuery.data.data.length === 0 && (
              <p className="text-gray-400 text-sm">No alert events recorded.</p>
            )}
            {triggeredQuery.data && triggeredQuery.data.data.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Alert', 'Value', 'Threshold', 'Status', 'Triggered At'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {triggeredQuery.data.data.map((e: SystemAlertEvent) => (
                      <tr key={e.event_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{e.alert_name ?? e.alert_id}</td>
                        <td className="px-4 py-3 text-gray-600">{e.metric_value}</td>
                        <td className="px-4 py-3 text-gray-600">{e.threshold_value}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColour(e.status)}`}>
                            {e.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{new Date(e.triggered_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, accent = 'neutral' }: { label: string; value: string; accent?: 'green' | 'yellow' | 'red' | 'neutral' }) {
  const colours = {
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    red: 'bg-red-50 border-red-200',
    neutral: 'bg-white border-gray-200',
  };
  return (
    <div className={`rounded-lg border p-4 ${colours[accent]}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${seconds % 60}s`;
}
