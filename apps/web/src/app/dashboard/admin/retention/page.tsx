'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

export default function RetentionPoliciesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    course_type: '',
    programme: '',
    regulatory_requirement: '',
    retention_months: 84,
    access_level: 'read_only' as 'read_only' | 'restricted' | 'none',
    disposal_action: 'archive' as 'archive' | 'delete' | 'export',
  });

  const resetForm = () => {
    setForm({
      name: '', description: '', course_type: '', programme: '',
      regulatory_requirement: '', retention_months: 84,
      access_level: 'read_only', disposal_action: 'archive',
    });
    setEditId(null);
    setShowForm(false);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['retention-policies'],
    queryFn: () => apiClient.getRetentionPolicies(),
  });

  const createMutation = useMutation({
    mutationFn: () => apiClient.createRetentionPolicy(form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['retention-policies'] }); resetForm(); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => apiClient.updateRetentionPolicy(editId!, form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['retention-policies'] }); resetForm(); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteRetentionPolicy(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['retention-policies'] }); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const startEdit = (policy: NonNullable<typeof data>['data'][number]) => {
    setForm({
      name: policy.name,
      description: policy.description ?? '',
      course_type: policy.course_type ?? '',
      programme: policy.programme ?? '',
      regulatory_requirement: policy.regulatory_requirement ?? '',
      retention_months: policy.retention_months,
      access_level: policy.access_level,
      disposal_action: policy.disposal_action,
    });
    setEditId(policy.policy_id);
    setShowForm(true);
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Link href="/dashboard" className="hover:text-blue-600">Dashboard</Link>
          <span>›</span>
          <span className="text-gray-900">Retention Policies</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Retention Policies</h1>
            <p className="text-gray-500 mt-1">
              Configure how long course records are kept and what happens at end of retention.
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            + New Policy
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Policy Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            {editId ? 'Edit Policy' : 'New Retention Policy'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. NZQA 7-Year Academic"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Regulatory Requirement</label>
              <input
                type="text"
                value={form.regulatory_requirement}
                onChange={e => setForm(f => ({ ...f, regulatory_requirement: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. NZQA-7yr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Retention (months)</label>
              <input
                type="number"
                value={form.retention_months}
                onChange={e => setForm(f => ({ ...f, retention_months: Number(e.target.value) }))}
                min={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Access During Retention</label>
              <select
                value={form.access_level}
                onChange={e => setForm(f => ({ ...f, access_level: e.target.value as typeof form.access_level }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="read_only">Read Only</option>
                <option value="restricted">Restricted</option>
                <option value="none">No Access</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Disposal Action</label>
              <select
                value={form.disposal_action}
                onChange={e => setForm(f => ({ ...f, disposal_action: e.target.value as typeof form.disposal_action }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="archive">Archive</option>
                <option value="delete">Delete</option>
                <option value="export">Export</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Programme Filter</label>
              <input
                type="text"
                value={form.programme}
                onChange={e => setForm(f => ({ ...f, programme: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. NZ2992"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => editId ? updateMutation.mutate() : createMutation.mutate()}
              disabled={!form.name || createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving…' : editId ? 'Update Policy' : 'Create Policy'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Policies List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : data?.data?.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No retention policies yet</h3>
          <p className="text-gray-500">Create a retention policy to control how long course records are kept.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3 text-left">Policy</th>
                  <th className="px-6 py-3 text-right">Retention</th>
                  <th className="px-6 py-3 text-center">Access</th>
                  <th className="px-6 py-3 text-center">Disposal</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.data?.map(policy => (
                  <tr key={policy.policy_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{policy.name}</p>
                      {policy.regulatory_requirement && (
                        <p className="text-xs text-gray-500">{policy.regulatory_requirement}</p>
                      )}
                      {policy.description && (
                        <p className="text-xs text-gray-400 mt-1">{policy.description}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-medium">
                      {policy.retention_months >= 12
                        ? `${Math.round(policy.retention_months / 12)} yr${Math.round(policy.retention_months / 12) !== 1 ? 's' : ''}`
                        : `${policy.retention_months} mo`}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        policy.access_level === 'read_only' ? 'bg-blue-100 text-blue-700' :
                        policy.access_level === 'restricted' ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {policy.access_level.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        policy.disposal_action === 'archive' ? 'bg-gray-100 text-gray-700' :
                        policy.disposal_action === 'export' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {policy.disposal_action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => startEdit(policy)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(policy.policy_id)}
                          disabled={deleteMutation.isPending}
                          className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
