'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { CompetencyFramework, Competency } from '@ako/shared';

type FrameworkWithTree = CompetencyFramework & { competencies?: Competency[] };

function CompetencyNode({ node, depth = 0, onDelete }: {
  node: Competency & { children?: Competency[] };
  depth?: number;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = (node as { children?: Competency[] }).children ?? [];
  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 group">
        <div className="flex items-center gap-2">
          {children.length > 0 && (
            <button onClick={() => setExpanded(e => !e)} className="text-gray-400 hover:text-gray-600 text-xs">
              {expanded ? '▼' : '▶'}
            </button>
          )}
          {children.length === 0 && <span className="w-4" />}
          <span className="text-sm text-gray-800">{node.short_name}</span>
          {node.idnumber && (
            <span className="text-xs text-gray-400 font-mono">[{node.idnumber}]</span>
          )}
        </div>
        <button
          onClick={() => onDelete(node.competency_id)}
          className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 text-xs"
        >
          Delete
        </button>
      </div>
      {expanded && children.map(child => (
        <CompetencyNode key={child.competency_id} node={child as Competency & { children?: Competency[] }} depth={depth + 1} onDelete={onDelete} />
      ))}
    </div>
  );
}

export default function FrameworkManagerPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAddComp, setShowAddComp] = useState(false);
  const [form, setForm] = useState({ name: '', version: '1.0', description: '' });
  const [importText, setImportText] = useState('');
  const [addCompForm, setAddCompForm] = useState({ short_name: '', description: '', idnumber: '', parent_id: '' });
  const [msg, setMsg] = useState('');

  const { data: fwData, isLoading } = useQuery({
    queryKey: ['competency-frameworks'],
    queryFn: () => apiClient.getCompetencyFrameworks(),
  });

  const { data: fwDetail } = useQuery({
    queryKey: ['competency-framework', selectedId],
    queryFn: () => apiClient.getCompetencyFramework(selectedId!),
    enabled: !!selectedId,
  });

  const frameworks = (fwData?.data ?? []) as CompetencyFramework[];
  const detail = fwDetail as FrameworkWithTree | undefined;

  const createMutation = useMutation({
    mutationFn: () => apiClient.createCompetencyFramework({
      name: form.name, version: form.version, description: form.description || undefined,
    }),
    onSuccess: (fw) => {
      qc.invalidateQueries({ queryKey: ['competency-frameworks'] });
      setShowCreate(false);
      setSelectedId(fw.framework_id);
      setForm({ name: '', version: '1.0', description: '' });
      setMsg('Framework created.');
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const deleteFwMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteCompetencyFramework(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competency-frameworks'] });
      setSelectedId(null);
      setMsg('Framework deleted.');
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const importMutation = useMutation({
    mutationFn: () => {
      const lines = importText.trim().split('\n').filter(Boolean);
      const rows = lines.map(line => {
        const parts = line.split(',');
        return {
          idnumber: parts[0]?.trim(),
          short_name: parts[1]?.trim() ?? '',
          description: parts[2]?.trim(),
          parent_idnumber: parts[3]?.trim() || undefined,
        };
      });
      return apiClient.importCompetencies(selectedId!, rows);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['competency-framework', selectedId] });
      setShowImport(false);
      setImportText('');
      setMsg(`Imported ${res.imported} competencies.`);
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const addCompMutation = useMutation({
    mutationFn: () => apiClient.createCompetency(selectedId!, {
      short_name: addCompForm.short_name,
      description: addCompForm.description || undefined,
      idnumber: addCompForm.idnumber || undefined,
      parent_id: addCompForm.parent_id || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competency-framework', selectedId] });
      setShowAddComp(false);
      setAddCompForm({ short_name: '', description: '', idnumber: '', parent_id: '' });
      setMsg('Competency added.');
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const deleteCompMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteCompetency(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competency-framework', selectedId] });
      setMsg('Competency deleted.');
    },
    onError: (e: Error) => setMsg(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Competency Framework Manager</h1>
        <button
          onClick={() => { setShowCreate(true); setMsg(''); }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
        >
          + New Framework
        </button>
      </div>

      {msg && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-800 text-sm">
          {msg}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-gray-700">New Framework</h3>
          <input
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="Framework name *"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <input
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="Version (default 1.0)"
            value={form.version}
            onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
          />
          <textarea
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="Description (optional)"
            rows={2}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
          <div className="flex gap-2">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!form.name || createMutation.isPending}
              className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-300 rounded text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Framework list */}
        <div className="col-span-1 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800 text-sm">Frameworks</h2>
          </div>
          {isLoading && <p className="p-4 text-gray-500 text-sm">Loading…</p>}
          {frameworks.length === 0 && !isLoading && (
            <p className="p-4 text-gray-500 text-sm">No frameworks yet.</p>
          )}
          <div className="divide-y divide-gray-100">
            {frameworks.map(fw => (
              <div
                key={fw.framework_id}
                onClick={() => { setSelectedId(fw.framework_id); setMsg(''); }}
                className={`px-4 py-3 cursor-pointer hover:bg-indigo-50 ${selectedId === fw.framework_id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''}`}
              >
                <p className="font-medium text-gray-800 text-sm">{fw.name}</p>
                <p className="text-xs text-gray-500">v{fw.version} · {fw.competency_count ?? 0} competencies · {fw.source}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="col-span-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
          {!selectedId && (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              Select a framework to view its competency tree
            </div>
          )}
          {selectedId && detail && (
            <>
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-800">{detail.name}</h2>
                  <p className="text-xs text-gray-500">{detail.description}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowAddComp(true); setMsg(''); }}
                    className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                  >
                    + Add Competency
                  </button>
                  <button
                    onClick={() => { setShowImport(true); setMsg(''); }}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                  >
                    Import CSV
                  </button>
                  <button
                    onClick={() => apiClient.exportFrameworkCsv(selectedId).then(() => setMsg('CSV exported.')).catch((e: Error) => setMsg(e.message))}
                    className="px-3 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50"
                  >
                    Export
                  </button>
                  <button
                    onClick={() => { if (confirm('Delete this framework?')) deleteFwMutation.mutate(selectedId); }}
                    className="px-3 py-1.5 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Import panel */}
              {showImport && (
                <div className="p-4 border-b border-gray-200 bg-yellow-50 space-y-2">
                  <p className="text-xs text-gray-600 font-medium">
                    Paste CSV rows: <code>idnumber,short_name,description,parent_idnumber</code>
                  </p>
                  <textarea
                    className="w-full border border-gray-300 rounded px-3 py-2 text-xs font-mono"
                    rows={5}
                    placeholder="C1,Critical Thinking,Analyse and evaluate information,&#10;C1.1,Analysis,Break down complex info,C1"
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => importMutation.mutate()}
                      disabled={!importText.trim() || importMutation.isPending}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                    >
                      {importMutation.isPending ? 'Importing…' : 'Import'}
                    </button>
                    <button onClick={() => setShowImport(false)} className="px-3 py-1.5 border border-gray-300 rounded text-xs">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Add competency panel */}
              {showAddComp && (
                <div className="p-4 border-b border-gray-200 bg-green-50 space-y-2">
                  <p className="text-xs text-gray-600 font-medium">Add Competency</p>
                  <input
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="Short name *"
                    value={addCompForm.short_name}
                    onChange={e => setAddCompForm(f => ({ ...f, short_name: e.target.value }))}
                  />
                  <input
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="Description (optional)"
                    value={addCompForm.description}
                    onChange={e => setAddCompForm(f => ({ ...f, description: e.target.value }))}
                  />
                  <input
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="ID number (optional)"
                    value={addCompForm.idnumber}
                    onChange={e => setAddCompForm(f => ({ ...f, idnumber: e.target.value }))}
                  />
                  <input
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="Parent competency UUID (optional)"
                    value={addCompForm.parent_id}
                    onChange={e => setAddCompForm(f => ({ ...f, parent_id: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => addCompMutation.mutate()}
                      disabled={!addCompForm.short_name || addCompMutation.isPending}
                      className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                    >
                      {addCompMutation.isPending ? 'Adding…' : 'Add'}
                    </button>
                    <button onClick={() => setShowAddComp(false)} className="px-3 py-1.5 border border-gray-300 rounded text-xs">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Competency tree */}
              <div className="p-4">
                {(!detail.competencies || detail.competencies.length === 0) && (
                  <p className="text-gray-500 text-sm">No competencies yet. Add or import some.</p>
                )}
                {(detail.competencies ?? []).map(node => (
                  <CompetencyNode
                    key={node.competency_id}
                    node={node as Competency & { children?: Competency[] }}
                    depth={0}
                    onDelete={(id) => { if (confirm('Delete competency?')) deleteCompMutation.mutate(id); }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
