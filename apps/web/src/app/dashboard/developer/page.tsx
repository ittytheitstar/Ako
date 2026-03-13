'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import type { Webhook } from '@ako/shared';

const AVAILABLE_EVENTS = [
  'plugin.installed', 'plugin.enabled', 'plugin.disabled',
  'integration.connected', 'integration.failed',
  'automation.triggered', 'automation.evaluated',
  'featureflag.changed',
  'course.archived', 'course.restored',
  'enrolment.created', 'grade.updated',
];

const AVAILABLE_SCOPES = [
  'courses:read', 'courses:write',
  'users:read', 'users:write',
  'grades:read', 'grades:write',
  'forums:read', 'forums:write',
  'reports:read',
  'admin:read', 'admin:write',
];

export default function DeveloperConsolePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'keys' | 'webhooks' | 'automation'>('keys');
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);

  // ── API Keys state
  const [keyForm, setKeyForm] = useState({ name: '', scopes: [] as string[] });

  // ── Webhook state
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [webhookForm, setWebhookForm] = useState({ name: '', target_url: '', event_types: [] as string[], secret: '' });
  const [testEvent, setTestEvent] = useState('plugin.enabled');
  const [testResult, setTestResult] = useState<{ webhooks_notified: number; results: unknown[] } | null>(null);

  // ── Automation state
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleForm, setRuleForm] = useState({ name: '', trigger_event: '', description: '' });

  const keysQuery = useQuery({
    queryKey: ['developer-keys'],
    queryFn: () => apiClient.getDeveloperKeys(),
    enabled: activeTab === 'keys',
  });

  const webhooksQuery = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => apiClient.getWebhooks(),
    enabled: activeTab === 'webhooks',
  });

  const automationQuery = useQuery({
    queryKey: ['automation-rules'],
    queryFn: () => apiClient.getAutomationRules(),
    enabled: activeTab === 'automation',
  });

  const createKeyMutation = useMutation({
    mutationFn: (d: { name: string; scopes: string[] }) => apiClient.createDeveloperKey(d),
    onSuccess: (data) => {
      setNewKey((data as { key: string }).key);
      queryClient.invalidateQueries({ queryKey: ['developer-keys'] });
      setKeyForm({ name: '', scopes: [] });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (id: string) => apiClient.revokeDeveloperKey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['developer-keys'] }),
    onError: (e: Error) => setError(e.message),
  });

  const createWebhookMutation = useMutation({
    mutationFn: (d: typeof webhookForm) =>
      apiClient.createWebhook({ name: d.name, target_url: d.target_url, event_types: d.event_types, secret: d.secret || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setShowWebhookForm(false);
      setWebhookForm({ name: '', target_url: '', event_types: [], secret: '' });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteWebhook(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
    onError: (e: Error) => setError(e.message),
  });

  const toggleWebhookMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiClient.updateWebhook(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
    onError: (e: Error) => setError(e.message),
  });

  const createRuleMutation = useMutation({
    mutationFn: (d: typeof ruleForm) => apiClient.createAutomationRule(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      setShowRuleForm(false);
      setRuleForm({ name: '', trigger_event: '', description: '' });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteAutomationRule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automation-rules'] }),
    onError: (e: Error) => setError(e.message),
  });

  const toggleScope = (scope: string) =>
    setKeyForm(f => ({
      ...f,
      scopes: f.scopes.includes(scope) ? f.scopes.filter(s => s !== scope) : [...f.scopes, scope],
    }));

  const toggleEventType = (evt: string) =>
    setWebhookForm(f => ({
      ...f,
      event_types: f.event_types.includes(evt)
        ? f.event_types.filter(e => e !== evt)
        : [...f.event_types, evt],
    }));

  const fireTestEvent = async () => {
    try {
      const r = await apiClient.testWebhookEvent({ event_type: testEvent, payload: { test: true } });
      setTestResult(r);
    } catch (e) {
      setError(String(e));
    }
  };

  const tabs = [
    { id: 'keys' as const, label: 'API Keys', icon: '🔑' },
    { id: 'webhooks' as const, label: 'Webhooks', icon: '🪝' },
    { id: 'automation' as const, label: 'Automation Rules', icon: '🤖' },
  ];

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Link href="/dashboard" className="hover:text-blue-600">Dashboard</Link>
          <span>›</span>
          <span className="text-gray-900">Developer Console</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Developer Console</h1>
        <p className="text-gray-500 mt-1">Manage API keys, webhooks, and automation rules.</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="underline">Dismiss</button>
        </div>
      )}

      {newKey && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-sm font-semibold text-green-800 mb-1">🎉 API Key created — copy it now, it will not be shown again.</p>
          <code className="block text-sm font-mono bg-white border border-green-300 rounded px-3 py-2 break-all text-green-900">
            {newKey}
          </code>
          <button
            onClick={() => { navigator.clipboard.writeText(newKey); }}
            className="mt-2 px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200"
          >
            Copy to Clipboard
          </button>
          <button onClick={() => setNewKey(null)} className="ml-2 text-xs text-green-600 underline">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* ── API Keys Tab ─────────────────────────────────────── */}
      {activeTab === 'keys' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Create New API Key</h3>
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Key Name</label>
                <input
                  type="text"
                  value={keyForm.name}
                  onChange={e => setKeyForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="my-integration"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Permission Scopes</label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_SCOPES.map(scope => (
                  <label key={scope} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={keyForm.scopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    <span className="text-xs font-mono text-gray-700">{scope}</span>
                  </label>
                ))}
              </div>
            </div>
            <button
              onClick={() => createKeyMutation.mutate(keyForm)}
              disabled={!keyForm.name || createKeyMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {createKeyMutation.isPending ? 'Creating…' : 'Generate Key'}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Your API Keys</h2>
            </div>
            {keysQuery.isLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" /></div>
            ) : !keysQuery.data?.data?.length ? (
              <div className="px-6 py-10 text-center text-gray-500 text-sm">No API keys yet.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {keysQuery.data.data.map(k => (
                  <div key={k.key_id} className="px-6 py-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm">{k.name}</span>
                        {!k.active && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">revoked</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <code className="text-xs text-gray-500 font-mono">{k.key_prefix}…</code>
                        {k.scopes.length > 0 && <span className="text-xs text-gray-400">{k.scopes.join(', ')}</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Created {new Date(k.created_at).toLocaleDateString()}
                        {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                        {k.expires_at && ` · Expires ${new Date(k.expires_at).toLocaleDateString()}`}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`Revoke key "${k.name}"?`)) revokeKeyMutation.mutate(k.key_id);
                      }}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Webhooks Tab ─────────────────────────────────────── */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          {/* Test event fire */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Test Event Delivery</h3>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                <select
                  value={testEvent}
                  onChange={e => setTestEvent(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {AVAILABLE_EVENTS.map(ev => <option key={ev} value={ev}>{ev}</option>)}
                </select>
              </div>
              <button
                onClick={fireTestEvent}
                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700"
              >
                🚀 Fire Test Event
              </button>
            </div>
            {testResult && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
                <span className="font-medium">{testResult.webhooks_notified} webhook(s) notified</span>
                <pre className="text-xs text-gray-500 mt-1 overflow-auto">{JSON.stringify(testResult.results, null, 2)}</pre>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setShowWebhookForm(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              + Add Webhook
            </button>
          </div>

          {showWebhookForm && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">New Webhook</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input type="text" value={webhookForm.name}
                    onChange={e => setWebhookForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target URL *</label>
                  <input type="url" value={webhookForm.target_url}
                    onChange={e => setWebhookForm(f => ({ ...f, target_url: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..." />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Secret (optional, for HMAC verification)</label>
                  <input type="text" value={webhookForm.secret}
                    onChange={e => setWebhookForm(f => ({ ...f, secret: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="my-webhook-secret" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subscribe to Events</label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_EVENTS.map(ev => (
                      <label key={ev} className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={webhookForm.event_types.includes(ev)}
                          onChange={() => toggleEventType(ev)} className="rounded border-gray-300 text-blue-600" />
                        <span className="text-xs font-mono text-gray-700">{ev}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => createWebhookMutation.mutate(webhookForm)}
                  disabled={!webhookForm.name || !webhookForm.target_url || createWebhookMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {createWebhookMutation.isPending ? 'Creating…' : 'Create Webhook'}
                </button>
                <button onClick={() => setShowWebhookForm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Registered Webhooks</h2>
            </div>
            {webhooksQuery.isLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" /></div>
            ) : !webhooksQuery.data?.data?.length ? (
              <div className="px-6 py-10 text-center text-gray-500 text-sm">No webhooks registered yet.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {webhooksQuery.data.data.map((wh: Webhook) => (
                  <div key={wh.webhook_id} className="px-6 py-4 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm">{wh.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${wh.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {wh.active ? 'active' : 'inactive'}
                        </span>
                        {wh.failure_count > 0 && (
                          <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">{wh.failure_count} failures</span>
                        )}
                      </div>
                      <code className="text-xs text-gray-500 block mt-0.5">{wh.target_url}</code>
                      {wh.event_types.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {wh.event_types.map(e => (
                            <span key={e} className="text-xs font-mono bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded">{e}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => toggleWebhookMutation.mutate({ id: wh.webhook_id, active: !wh.active })}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        {wh.active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete webhook "${wh.name}"?`)) deleteWebhookMutation.mutate(wh.webhook_id); }}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Automation Tab ───────────────────────────────────── */}
      {activeTab === 'automation' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowRuleForm(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              + New Rule
            </button>
          </div>

          {showRuleForm && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Create Automation Rule</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name *</label>
                  <input type="text" value={ruleForm.name}
                    onChange={e => setRuleForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Event *</label>
                  <select value={ruleForm.trigger_event}
                    onChange={e => setRuleForm(f => ({ ...f, trigger_event: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select event…</option>
                    {AVAILABLE_EVENTS.map(ev => <option key={ev} value={ev}>{ev}</option>)}
                    <option value="enrolment.anomaly_detected">enrolment.anomaly_detected</option>
                    <option value="learner.inactive">learner.inactive</option>
                    <option value="course.readiness_check">course.readiness_check</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input type="text" value={ruleForm.description}
                    onChange={e => setRuleForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="What does this rule do?" />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">Conditions and actions can be configured via the API after creation.</p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => createRuleMutation.mutate(ruleForm)}
                  disabled={!ruleForm.name || !ruleForm.trigger_event || createRuleMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {createRuleMutation.isPending ? 'Creating…' : 'Create Rule'}
                </button>
                <button onClick={() => setShowRuleForm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Automation Rules</h2>
            </div>
            {automationQuery.isLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" /></div>
            ) : !automationQuery.data?.data?.length ? (
              <div className="px-6 py-10 text-center text-gray-500 text-sm">No automation rules configured.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {automationQuery.data.data.map(rule => (
                  <div key={rule.rule_id} className="px-6 py-4 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm">{rule.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${rule.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {rule.active ? 'active' : 'inactive'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Trigger: <code className="font-mono">{rule.trigger_event}</code>
                        {rule.trigger_count > 0 && <span className="ml-3">Triggered {rule.trigger_count}×</span>}
                      </div>
                      {rule.description && <p className="text-xs text-gray-400 mt-0.5">{rule.description}</p>}
                    </div>
                    <button
                      onClick={() => { if (confirm(`Delete rule "${rule.name}"?`)) deleteRuleMutation.mutate(rule.rule_id); }}
                      className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                    >
                      Delete
                    </button>
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
