'use client';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

export default function ForumsPage() {
  const { data: forums, isLoading } = useQuery({
    queryKey: ['forums'],
    queryFn: () => apiClient.getForums(),
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Forums</h1>
        <p className="text-gray-500 mt-1">Discussion boards for your courses</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-3">
          {forums?.data?.map((forum) => (
            <Link
              key={forum.forum_id}
              href={`/dashboard/forums/${forum.forum_id}`}
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <span className="text-indigo-600 text-lg">💬</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{forum.title}</p>
                  <p className="text-sm text-gray-500">Click to view threads</p>
                </div>
              </div>
            </Link>
          ))}
          {forums?.data?.length === 0 && (
            <div className="text-center py-16 text-gray-500">No forums available</div>
          )}
        </div>
      )}
    </div>
  );
}
