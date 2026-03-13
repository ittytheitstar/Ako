'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import type { GradeScale, GradeScaleLevel } from '@ako/shared';

export default function GradeScalesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [levels, setLevels] = useState([{ name: '', value: 1 }]);

  const scalesQuery = useQuery({
    queryKey: ['grade-scales'],
    queryFn: () => apiClient.getGradeScales(),
  });

  const createScale = useMutation({
    mutationFn: () => apiClient.createGradeScale({
      name: newName,
      description: newDesc || undefined,
      levels: levels.filter(l => l.name.trim()),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grade-scales'] });
      setNewName('');
      setNewDesc('');
      setLevels([{ name: '', value: 1 }]);
      setShowForm(false);
    },
  });

  const deleteScale = useMutation({
    mutationFn: (id: string) => apiClient.deleteGradeScale(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grade-scales'] }),
  });

  const addLevel = () => setLevels(ls => [...ls, { name: '', value: ls.length + 1 }]);
  const removeLevel = (i: number) => setLevels(ls => ls.filter((_, idx) => idx !== i));
  const updateLevel = (i: number, field: 'name' | 'value', val: string | number) =>
    setLevels(ls => ls.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const scales = (scalesQuery.data?.data ?? []) as GradeScale[];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grade Scales</h1>
          <p className="text-sm text-gray-500 mt-1">Manage institution-wide grading scales</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/admin" className="text-sm text-blue-600 hover:underline">← Admin</Link>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
          >
            + New Scale
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
          <p className="text-sm font-medium text-gray-700">Create Grade Scale</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Scale Name</label>
              <input
                type="text"
                placeholder="e.g. Competency Scale"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Description (optional)</label>
              <input
                type="text"
                placeholder="Brief description"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">Levels (highest value = best)</label>
              <button onClick={addLevel} className="text-xs text-blue-600 hover:underline">+ Add Level</button>
            </div>
            <div className="space-y-2">
              {levels.map((level, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Level name (e.g. Excellent)"
                    value={level.name}
                    onChange={e => updateLevel(i, 'name', e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Value"
                    value={level.value}
                    onChange={e => updateLevel(i, 'value', Number(e.target.value))}
                    className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  />
                  {levels.length > 1 && (
                    <button onClick={() => removeLevel(i)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createScale.mutate()}
              disabled={!newName || levels.every(l => !l.name.trim()) || createScale.isPending}
              className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {createScale.isPending ? 'Saving…' : 'Create Scale'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-3 py-2">Cancel</button>
          </div>
        </div>
      )}

      {scalesQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : scales.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white border border-gray-100 rounded-lg">
          No grade scales yet. Create one above.
        </div>
      ) : (
        <div className="space-y-3">
          {scales.map((scale: GradeScale) => (
            <div key={scale.scale_id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{scale.name}</h3>
                  {scale.description && <p className="text-sm text-gray-500 mt-0.5">{scale.description}</p>}
                </div>
                <button
                  onClick={() => deleteScale.mutate(scale.scale_id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
              {scale.levels && scale.levels.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(scale.levels as GradeScaleLevel[]).sort((a, b) => b.value - a.value).map((level: GradeScaleLevel) => (
                    <span
                      key={level.level_id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-full text-xs text-gray-700"
                    >
                      <span className="font-medium">{level.name}</span>
                      <span className="text-gray-400">({level.value})</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
