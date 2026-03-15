'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { BackupJob, RestoreJob, Course } from '@ako/shared';

const STATUS_COLOURS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  running: 'bg-blue-100 text-blue-700',
  complete: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

function formatBytes(bytes: number) {
  if (bytes === 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-NZ', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminBackupPage() {
  const [activeTab, setActiveTab] = useState<'backups' | 'restores' | 'new-backup' | 'new-restore'>('backups');
  const [backupCourseId, setBackupCourseId] = useState('');
  const [backupOptions, setBackupOptions] = useState({ include_files: false, include_submissions: false });
  const [restoreForm, setRestoreForm] = useState({ title: '', course_code: '' });

  const queryClient = useQueryClient();

  const backupJobsQuery = useQuery({
    queryKey: ['admin-backup-jobs'],
    queryFn: () => apiClient.getBackupJobs(),
  });

  const restoreJobsQuery = useQuery({
    queryKey: ['admin-restore-jobs'],
    queryFn: () => apiClient.getRestoreJobs(),
  });

  const coursesQuery = useQuery({
    queryKey: ['courses'],
    queryFn: () => apiClient.getCourses(),
  });

  const backupJobs: BackupJob[] = backupJobsQuery.data?.data ?? [];
  const restoreJobs: RestoreJob[] = restoreJobsQuery.data?.data ?? [];
  const courses: Course[] = (coursesQuery.data as { data?: Course[] })?.data ?? [];

  const startBackupMutation = useMutation({
    mutationFn: () => apiClient.startBackup(backupCourseId, backupOptions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-backup-jobs'] });
      setActiveTab('backups');
      setBackupCourseId('');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () =>
      apiClient.restoreFromBackup({
        title: restoreForm.title || undefined,
        course_code: restoreForm.course_code || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-restore-jobs'] });
      setActiveTab('restores');
      setRestoreForm({ title: '', course_code: '' });
    },
  });

  const totalStorage = backupJobs.reduce((sum, j) => sum + (j.file_size_bytes ?? 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Backup &amp; Restore Management</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage course backups and restores across the institution.
        </p>
      </div>

      {/* Storage summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total backups</p>
          <p className="text-2xl font-semibold text-gray-900">{backupJobs.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Storage used</p>
          <p className="text-2xl font-semibold text-gray-900">{formatBytes(totalStorage)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Restores</p>
          <p className="text-2xl font-semibold text-gray-900">{restoreJobs.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {([
            ['backups', 'Backup jobs'],
            ['restores', 'Restore jobs'],
            ['new-backup', 'New backup'],
            ['new-restore', 'Restore from backup'],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'backups' && (
        <div className="overflow-x-auto">
          {backupJobsQuery.isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : backupJobs.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-4xl mb-3">📦</p>
              <p className="font-medium">No backups yet</p>
              <p className="text-sm mt-1">
                Use{' '}
                <button onClick={() => setActiveTab('new-backup')} className="text-indigo-600 underline">
                  New backup
                </button>{' '}
                to create your first backup.
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {backupJobs.map((job) => (
                  <tr key={job.job_id}>
                    <td className="px-4 py-3 text-sm text-gray-900">{job.course_title ?? job.course_id}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOURS[job.status] ?? ''}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatBytes(job.file_size_bytes ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(job.created_at)}</td>
                    <td className="px-4 py-3">
                      {job.status === 'complete' && (
                        <button
                          onClick={() => apiClient.getBackupDownload(job.job_id)}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          Download
                        </button>
                      )}
                      {job.error_message && (
                        <span className="text-xs text-red-600" title={job.error_message}>Error</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'restores' && (
        <div className="overflow-x-auto">
          {restoreJobsQuery.isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : restoreJobs.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-4xl mb-3">🔄</p>
              <p className="font-medium">No restore jobs yet</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target course</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Warnings</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {restoreJobs.map((job) => (
                  <tr key={job.job_id}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {job.target_course_title ?? job.target_course_id ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOURS[job.status] ?? ''}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {job.warnings.length > 0 ? `${job.warnings.length} warning(s)` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(job.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'new-backup' && (
        <div className="max-w-md">
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <h2 className="font-medium text-gray-900">Start a new backup</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select course *</label>
              <select
                value={backupCourseId}
                onChange={(e) => setBackupCourseId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Choose a course —</option>
                {courses
                  .filter((c) => c.status !== 'deleted')
                  .map((c) => (
                    <option key={c.course_id} value={c.course_id}>
                      {c.title} ({c.course_code})
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Options</p>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={backupOptions.include_files}
                  onChange={(e) => setBackupOptions({ ...backupOptions, include_files: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Include uploaded file blobs</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={backupOptions.include_submissions}
                  onChange={(e) => setBackupOptions({ ...backupOptions, include_submissions: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Include learner submissions</span>
              </label>
            </div>

            {startBackupMutation.isError && (
              <p className="text-sm text-red-600">{(startBackupMutation.error as Error).message}</p>
            )}

            <button
              onClick={() => startBackupMutation.mutate()}
              disabled={startBackupMutation.isPending || !backupCourseId}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {startBackupMutation.isPending ? 'Starting…' : 'Start backup'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'new-restore' && (
        <div className="max-w-md">
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <h2 className="font-medium text-gray-900">Restore from backup</h2>
            <p className="text-sm text-gray-500">
              Upload a backup package to restore it into a new draft course.
            </p>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <p className="text-gray-500 text-sm">📂 File upload — coming soon</p>
              <p className="text-xs text-gray-400 mt-1">ZIP backup packages (.zip)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New course title</label>
              <input
                type="text"
                value={restoreForm.title}
                onChange={(e) => setRestoreForm({ ...restoreForm, title: e.target.value })}
                placeholder="Restored Course"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course code</label>
              <input
                type="text"
                value={restoreForm.course_code}
                onChange={(e) => setRestoreForm({ ...restoreForm, course_code: e.target.value })}
                placeholder={`RESTORE-${new Date().getFullYear()}`}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {restoreMutation.isError && (
              <p className="text-sm text-red-600">{(restoreMutation.error as Error).message}</p>
            )}
            {restoreMutation.isSuccess && (
              <p className="text-sm text-green-600">✅ Restore job started!</p>
            )}

            <button
              onClick={() => restoreMutation.mutate()}
              disabled={restoreMutation.isPending}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {restoreMutation.isPending ? 'Starting restore…' : 'Start restore'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
