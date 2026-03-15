'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { CourseTemplate, Course } from '@ako/shared';

export default function AdminTemplatesPage() {
  const [activeTab, setActiveTab] = useState<'library' | 'promote'>('library');
  const [promoteForm, setPromoteForm] = useState({
    course_id: '',
    template_category: '',
    template_tags: '',
    template_description: '',
  });
  const [editingTemplate, setEditingTemplate] = useState<CourseTemplate | null>(null);
  const [editForm, setEditForm] = useState({
    template_category: '',
    template_tags: '',
    template_description: '',
  });

  const queryClient = useQueryClient();

  const templatesQuery = useQuery({
    queryKey: ['admin-templates'],
    queryFn: () => apiClient.getCourseTemplates(),
  });

  const coursesQuery = useQuery({
    queryKey: ['courses'],
    queryFn: () => apiClient.getCourses(),
  });

  const templates: CourseTemplate[] = templatesQuery.data?.data ?? [];
  const courses: Course[] = (coursesQuery.data as { data?: Course[] })?.data ?? [];
  const nonTemplateCourses = courses.filter((c) => !c.is_template && c.status !== 'deleted');

  const promoteMutation = useMutation({
    mutationFn: () =>
      apiClient.promoteTemplate(promoteForm.course_id, {
        template_category: promoteForm.template_category || undefined,
        template_tags: promoteForm.template_tags
          ? promoteForm.template_tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        template_description: promoteForm.template_description || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setPromoteForm({ course_id: '', template_category: '', template_tags: '', template_description: '' });
      setActiveTab('library');
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      apiClient.promoteTemplate(editingTemplate!.course_id, {
        template_category: editForm.template_category || undefined,
        template_tags: editForm.template_tags
          ? editForm.template_tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        template_description: editForm.template_description || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      setEditingTemplate(null);
    },
  });

  const demoteMutation = useMutation({
    mutationFn: (courseId: string) => apiClient.demoteTemplate(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });

  const openEdit = (template: CourseTemplate) => {
    setEditingTemplate(template);
    setEditForm({
      template_category: template.template_category ?? '',
      template_tags: (template.template_tags ?? []).join(', '),
      template_description: template.template_description ?? '',
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Template Library Manager</h1>
        <p className="mt-1 text-sm text-gray-500">
          Promote courses to templates and manage the template library.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {(['library', 'promote'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'library' ? `Template library (${templates.length})` : 'Promote a course'}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'library' && (
        <>
          {templatesQuery.isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-medium">No templates yet</p>
              <p className="text-sm mt-1">
                Use the{' '}
                <button
                  onClick={() => setActiveTab('promote')}
                  className="text-indigo-600 underline"
                >
                  Promote a course
                </button>{' '}
                tab to designate a course as a template.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tags</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {templates.map((template) => (
                    <tr key={template.course_id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 text-sm">{template.title}</div>
                        {template.template_description && (
                          <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                            {template.template_description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{template.course_code}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {template.template_category ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(template.template_tags ?? []).map((tag) => (
                            <span key={tag} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(template)}
                            className="text-xs text-indigo-600 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => demoteMutation.mutate(template.course_id)}
                            disabled={demoteMutation.isPending}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Demote
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'promote' && (
        <div className="max-w-lg">
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <h2 className="font-medium text-gray-900">Designate a course as a template</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select course *</label>
              <select
                value={promoteForm.course_id}
                onChange={(e) => setPromoteForm({ ...promoteForm, course_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Choose a course —</option>
                {nonTemplateCourses.map((c) => (
                  <option key={c.course_id} value={c.course_id}>
                    {c.title} ({c.course_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input
                type="text"
                value={promoteForm.template_category}
                onChange={(e) => setPromoteForm({ ...promoteForm, template_category: e.target.value })}
                placeholder="e.g. Undergraduate, Professional Development"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
              <input
                type="text"
                value={promoteForm.template_tags}
                onChange={(e) => setPromoteForm({ ...promoteForm, template_tags: e.target.value })}
                placeholder="e.g. science, lab, semester-1"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={promoteForm.template_description}
                onChange={(e) => setPromoteForm({ ...promoteForm, template_description: e.target.value })}
                rows={3}
                placeholder="Brief description of this template's purpose"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {promoteMutation.isError && (
              <p className="text-sm text-red-600">{(promoteMutation.error as Error).message}</p>
            )}

            <button
              onClick={() => promoteMutation.mutate()}
              disabled={promoteMutation.isPending || !promoteForm.course_id}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {promoteMutation.isPending ? 'Saving…' : 'Promote to template'}
            </button>
          </div>
        </div>
      )}

      {/* Edit template modal */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Edit template</h2>
            <p className="text-sm text-gray-500">
              <strong>{editingTemplate.title}</strong>
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input
                type="text"
                value={editForm.template_category}
                onChange={(e) => setEditForm({ ...editForm, template_category: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
              <input
                type="text"
                value={editForm.template_tags}
                onChange={(e) => setEditForm({ ...editForm, template_tags: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={editForm.template_description}
                onChange={(e) => setEditForm({ ...editForm, template_description: e.target.value })}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving…' : 'Save changes'}
              </button>
              <button
                onClick={() => setEditingTemplate(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
