'use client';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import type { PermissionAuditLog } from '@ako/shared';

export default function PermissionsAuditPage() {
  const [activeTab, setActiveTab] = useState<'matrix' | 'events' | 'anomalies'>('matrix');
  const [filterGranted, setFilterGranted] = useState<'all' | 'granted' | 'denied'>('all');
  const [filterPermission, setFilterPermission] = useState('');

  const matrixQuery = useQuery({
    queryKey: ['permission-matrix'],
    queryFn: () => apiClient.getPermissionMatrix(),
    enabled: activeTab === 'matrix',
  });

  const eventsQuery = useQuery({
    queryKey: ['permission-events', filterGranted, filterPermission],
    queryFn: () => apiClient.getPermissionAuditEvents({
      limit: 50,
      granted: filterGranted === 'all' ? undefined : filterGranted === 'granted',
      permission_name: filterPermission || undefined,
    }),
    enabled: activeTab === 'events',
  });

  const anomaliesQuery = useQuery({
    queryKey: ['permission-anomalies'],
    queryFn: () => apiClient.getPermissionAnomalies(),
    enabled: activeTab === 'anomalies',
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Permissions Audit</h1>
          <p className="text-sm text-gray-500 mt-1">Review role permissions, access events and anomalies</p>
        </div>
        <Link href="/dashboard/admin" className="text-sm text-blue-600 hover:underline">← Admin</Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {(['matrix', 'events', 'anomalies'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 text-sm font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'matrix' ? 'Permission Matrix' : tab === 'events' ? 'Audit Events' : 'Anomalies'}
            </button>
          ))}
        </nav>
      </div>

      {/* Permission Matrix */}
      {activeTab === 'matrix' && (
        <div>
          {matrixQuery.isLoading && <p className="text-gray-500">Loading matrix…</p>}
          {matrixQuery.data && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                {matrixQuery.data.roles.length} role(s) · {matrixQuery.data.permissions.length} permission(s)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 sticky left-0 bg-gray-50 border-r border-gray-200">Role</th>
                      {matrixQuery.data.permissions.map(p => (
                        <th key={p.permission_id} className="px-2 py-2 text-center font-medium text-gray-600 min-w-[120px]" title={p.description}>
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {matrixQuery.data.roles.map(role => (
                      <tr key={role.role_id} className="hover:bg-blue-50">
                        <td className="px-3 py-2 font-medium text-gray-800 sticky left-0 bg-white border-r border-gray-200">{role.role_name}</td>
                        {matrixQuery.data.permissions.map(p => (
                          <td key={p.permission_id} className="px-2 py-2 text-center">
                            {(role.permissions ?? []).includes(p.name) ? (
                              <span className="text-green-600 font-bold" title="Granted">✓</span>
                            ) : (
                              <span className="text-gray-300">–</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audit Events */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3 items-center flex-wrap">
            <select
              value={filterGranted}
              onChange={e => setFilterGranted(e.target.value as typeof filterGranted)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">All outcomes</option>
              <option value="granted">Granted</option>
              <option value="denied">Denied</option>
            </select>
            <input
              type="text"
              placeholder="Filter by permission name…"
              value={filterPermission}
              onChange={e => setFilterPermission(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-64"
            />
          </div>

          {eventsQuery.isLoading && <p className="text-gray-500">Loading…</p>}
          {eventsQuery.data && eventsQuery.data.data.length === 0 && (
            <p className="text-gray-400 text-sm">No audit events found.</p>
          )}
          {eventsQuery.data && eventsQuery.data.data.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Permission', 'Actor', 'Resource', 'Outcome', 'Denial Reason', 'Checked At'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {eventsQuery.data.data.map((e: PermissionAuditLog) => (
                    <tr key={e.audit_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{e.permission_name}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{e.actor_id ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{e.resource_type ? `${e.resource_type}/${e.resource_id}` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.granted ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {e.granted ? 'granted' : 'denied'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{e.denial_reason ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(e.checked_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Anomalies */}
      {activeTab === 'anomalies' && (
        <div className="space-y-6">
          {anomaliesQuery.isLoading && <p className="text-gray-500">Analysing…</p>}
          {anomaliesQuery.data && (
            <>
              <section>
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Overly Broad Roles</h2>
                {anomaliesQuery.data.broad_roles.length === 0 ? (
                  <p className="text-gray-400 text-sm">No overly broad roles detected.</p>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {['Role', 'Permission Count', 'Avg Count', 'Anomaly'].map(h => (
                            <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(anomaliesQuery.data.broad_roles as Array<{ role_id: string; role_name: string; perm_count: number; avg: number; anomaly_type: string }>).map(r => (
                          <tr key={r.role_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{r.role_name}</td>
                            <td className="px-4 py-3 text-gray-600">{r.perm_count}</td>
                            <td className="px-4 py-3 text-gray-500">{Number(r.avg).toFixed(1)}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                                {r.anomaly_type.replace('_', ' ')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section>
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Denial Spikes (last 24h)</h2>
                {anomaliesQuery.data.denial_spikes.length === 0 ? (
                  <p className="text-gray-400 text-sm">No unusual denial patterns detected.</p>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Permission</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Denial Count</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(anomaliesQuery.data.denial_spikes as Array<{ permission_name: string; denial_count: number }>).map(s => (
                          <tr key={s.permission_name} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-xs text-gray-700">{s.permission_name}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                {s.denial_count} denials
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2">Evaluated at {anomaliesQuery.data.evaluated_at}</p>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
