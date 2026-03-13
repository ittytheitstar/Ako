'use client';
import React, { useState, use } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

interface Props {
  params: Promise<{ id: string }>;
}

export default function CohortDetailPage({ params }: Props) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [memberSearch, setMemberSearch] = useState('');
  const [singleUserId, setSingleUserId] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [addError, setAddError] = useState('');
  const [bulkError, setBulkError] = useState('');

  const { data: cohort, isLoading: cohortLoading } = useQuery({
    queryKey: ['cohort', id],
    queryFn: () => apiClient.getCohort(id),
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['cohortMembers', id],
    queryFn: () => apiClient.getCohortMembers(id),
  });

  const { data: linkedCoursesData } = useQuery({
    queryKey: ['cohortCourses', id],
    queryFn: () => apiClient.getCohortCourses(id),
  });

  const linkedCourses = linkedCoursesData?.data ?? [];

  const addMemberMutation = useMutation({
    mutationFn: () => apiClient.addCohortMember(id, singleUserId.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cohortMembers', id] });
      setSingleUserId('');
      setAddError('');
    },
    onError: (e: Error) => setAddError(e.message),
  });

  const bulkAddMutation = useMutation({
    mutationFn: () => {
      const ids = bulkText
        .split(/[\n,]+/)
        .map(s => s.trim())
        .filter(Boolean);
      return apiClient.bulkAddCohortMembers(id, ids);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cohortMembers', id] });
      setBulkText('');
      setBulkError('');
      alert(`Added ${data.added} members`);
    },
    onError: (e: Error) => setBulkError(e.message),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => apiClient.removeCohortMember(id, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cohortMembers', id] }),
  });

  const syncMutation = useMutation({
    mutationFn: () => apiClient.reconcileCohortSync(id),
  });

  if (cohortLoading) {
    return (
      <div className="flex justify-center items-center h-full py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!cohort) return <div className="p-8 text-gray-500">Cohort not found</div>;

  const filteredMembers = members?.data?.filter(m =>
    m.display_name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.email?.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.user_id?.toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Link href="/dashboard/cohorts" className="hover:text-blue-600">Cohorts</Link>
          <span>›</span>
          <span className="text-gray-900">{cohort.name}</span>
        </div>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-2xl">{cohort.code.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{cohort.name}</h1>
              <p className="text-gray-500">{cohort.code}</p>
              <p className="text-sm text-gray-500 mt-1">{members?.data?.length ?? 0} members</p>
            </div>
          </div>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {syncMutation.isPending ? 'Syncing…' : '↻ Sync to Courses'}
          </button>
        </div>
        {syncMutation.isSuccess && (
          <div className="mt-3 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
            Sync complete: {syncMutation.data?.courses_synced} courses synced, {syncMutation.data?.enrolments_upserted} enrolments updated
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Members panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Members</h3>
              <input
                type="text"
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder="Search members…"
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {membersLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : filteredMembers?.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                {memberSearch ? 'No members match your search' : 'No members yet'}
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredMembers?.map(member => (
                  <div key={member.user_id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-700 text-sm font-medium">
                          {member.display_name?.charAt(0).toUpperCase() ?? '?'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{member.display_name}</p>
                        <p className="text-xs text-gray-500">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">
                        Added {new Date(member.added_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => removeMemberMutation.mutate(member.user_id)}
                        className="text-xs text-red-500 hover:text-red-700 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Add single member */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Add Member</h3>
            <input
              type="text"
              value={singleUserId}
              onChange={e => setSingleUserId(e.target.value)}
              placeholder="User ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            />
            {addError && <p className="text-xs text-red-600 mb-2">{addError}</p>}
            <button
              onClick={() => addMemberMutation.mutate()}
              disabled={addMemberMutation.isPending || !singleUserId.trim()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm transition-colors"
            >
              {addMemberMutation.isPending ? 'Adding…' : 'Add Member'}
            </button>
          </div>

          {/* Bulk add */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Bulk Add</h3>
            <p className="text-xs text-gray-500 mb-2">One user ID per line (or comma-separated)</p>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder="user-id-1&#10;user-id-2&#10;user-id-3"
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2 font-mono"
            />
            {bulkError && <p className="text-xs text-red-600 mb-2">{bulkError}</p>}
            <button
              onClick={() => bulkAddMutation.mutate()}
              disabled={bulkAddMutation.isPending || !bulkText.trim()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm transition-colors"
            >
              {bulkAddMutation.isPending ? 'Adding…' : 'Bulk Add'}
            </button>
          </div>

          {/* Linked courses */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Linked Courses</h3>
            {linkedCourses.length === 0 ? (
              <p className="text-sm text-gray-500">No courses linked to this cohort</p>
            ) : (
              <div className="space-y-2">
                {linkedCourses.map((course) => (
                  <Link
                    key={course.course_id}
                    href={`/dashboard/courses/${course.course_id}`}
                    className="block text-sm text-blue-600 hover:text-blue-700"
                  >
                    {course.title}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
