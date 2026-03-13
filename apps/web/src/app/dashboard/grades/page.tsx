'use client';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export default function GradesPage() {
  const { data: courses } = useQuery({
    queryKey: ['courses'],
    queryFn: () => apiClient.getCourses(),
  });

  const firstCourse = courses?.data?.[0];

  const { data: gradebook, isLoading } = useQuery({
    queryKey: ['gradebook', firstCourse?.course_id],
    queryFn: () => apiClient.getGradebook(firstCourse!.course_id),
    enabled: !!firstCourse,
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gradebook</h1>
        <p className="text-gray-500 mt-1">Your grades and performance</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : !gradebook ? (
        <div className="text-center py-16 text-gray-500">
          No grade data available. Enrol in a course to see grades.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">{firstCourse?.title}</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assignment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max Grade</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Your Grade</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Percentage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {gradebook.items.map((item) => {
                const grade = gradebook.grades.find(g => g.item_id === item.item_id);
                const pct = grade?.grade !== undefined && grade.grade !== null
                  ? Math.round((grade.grade / item.max_grade) * 100)
                  : null;
                return (
                  <tr key={item.item_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 capitalize">{item.source_type}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.max_grade}</td>
                    <td className="px-6 py-4 text-sm font-medium">
                      {grade?.grade !== undefined && grade.grade !== null ? grade.grade : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {pct !== null ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          pct >= 70 ? 'bg-green-100 text-green-700' :
                          pct >= 50 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {pct}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
              {gradebook.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No grade items yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
