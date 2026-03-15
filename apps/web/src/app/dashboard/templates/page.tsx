'use client';
import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { CourseTemplate, CopyJob } from '@ako/shared';

export default function TemplateBrowserPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<CourseTemplate | null>(null);
  const [createForm, setCreateForm] = useState({ title: '', course_code: '' });
  const [createdJob, setCreatedJob] = useState<CopyJob | null>(null);

  const templatesQuery = useQuery({
    queryKey: ['course-templates', search, category],
    queryFn: () =>
      apiClient.getCourseTemplates({
        q: search || undefined,
        category: category || undefined,
      }),
  });

  const templates: CourseTemplate[] = templatesQuery.data?.data ?? [];

  // Collect unique categories from returned templates
  const categories = Array.from(new Set(templates.map((t) => t.template_category).filter(Boolean) as string[])).sort();

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.createCourseFromTemplate(selectedTemplate!.course_id, {
        title: createForm.title,
        course_code: createForm.course_code,
      }),
    onSuccess: (job) => {
      setCreatedJob(job);
      setSelectedTemplate(null);
    },
  });

  if (createdJob && createdJob.status === 'complete') {
    return (
      <div className="max-w-xl mx-auto p-6">
        <div className="rounded-lg bg-green-50 border border-green-200 p-6">
          <h2 className="text-lg font-semibold text-green-800 mb-2">✅ Course created!</h2>
          <p className="text-sm text-gray-700 mb-4">
            Your new course <strong>{createForm.title}</strong> has been created from the template.
          </p>
          {createdJob.target_course_id && (
            <a
              href={`/dashboard/courses/${createdJob.target_course_id}`}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
            >
              Open course →
            </a>
          )}
          <button
            onClick={() => setCreatedJob(null)}
            className="ml-3 px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50"
          >
            Browse more templates
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Course Template Library</h1>
        <p className="mt-1 text-sm text-gray-500">
          Browse and use pre-built course templates to jump-start your next course.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search templates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {templatesQuery.isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">No templates found</p>
          <p className="text-sm mt-1">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div
              key={template.course_id}
              className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow"
            >
              {template.template_category && (
                <span className="inline-block text-xs font-medium px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full w-fit">
                  {template.template_category}
                </span>
              )}
              <div>
                <h3 className="font-medium text-gray-900">{template.title}</h3>
                <p className="text-xs text-gray-500">{template.course_code}</p>
              </div>
              {template.template_description && (
                <p className="text-sm text-gray-600 line-clamp-3">{template.template_description}</p>
              )}
              {template.template_tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {template.template_tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={() => {
                  setSelectedTemplate(template);
                  setCreateForm({ title: `Copy of ${template.title}`, course_code: '' });
                }}
                className="mt-auto px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 w-full"
              >
                Use this template
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create from template modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Create course from template
            </h2>
            <p className="text-sm text-gray-500">
              Template: <span className="font-medium">{selectedTemplate.title}</span>
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course title *</label>
              <input
                type="text"
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course code *</label>
              <input
                type="text"
                value={createForm.course_code}
                onChange={(e) => setCreateForm({ ...createForm, course_code: e.target.value })}
                placeholder="e.g. ENG101-2026"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {createMutation.isError && (
              <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !createForm.title.trim() || !createForm.course_code.trim()}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating…' : 'Create course'}
              </button>
              <button
                onClick={() => setSelectedTemplate(null)}
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
