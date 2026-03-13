'use client';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { GradeItem, Grade, GradeCategory, Course } from '@ako/shared';

export default function GradesPage() {
  const [selectedCourseId, setSelectedCourseId] = useState('');

  const { data: courses } = useQuery({
    queryKey: ['courses'],
    queryFn: () => apiClient.getCourses(),
  });

  const courseList = (courses?.data ?? []) as Course[];
  const activeCourseId = selectedCourseId || courseList[0]?.course_id;
  const activeCourse = courseList.find(c => c.course_id === activeCourseId);

  const { data: gradeItemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['grade-items', activeCourseId],
    queryFn: () => apiClient.getGradeItems(activeCourseId),
    enabled: !!activeCourseId,
  });

  const { data: gradesData, isLoading: gradesLoading } = useQuery({
    queryKey: ['my-grades', activeCourseId],
    queryFn: () => apiClient.getGrades(undefined, undefined),
    enabled: !!activeCourseId,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['grade-categories', activeCourseId],
    queryFn: () => apiClient.getGradeCategories({ course_id: activeCourseId }),
    enabled: !!activeCourseId,
  });

  const items = (gradeItemsData?.data ?? []) as GradeItem[];
  const grades = (gradesData?.data ?? []) as Grade[];
  const categories = (categoriesData?.data ?? []) as GradeCategory[];

  const isLoading = itemsLoading || gradesLoading;

  // Build category tree for display
  const topLevelCategories = categories.filter(c => !c.parent_id);

  const getItemsForCategory = (categoryId: string) =>
    items.filter(i => i.category_id === categoryId && !i.hidden);

  const uncategorisedItems = items.filter(i => !i.category_id && !i.hidden);

  const getGradeForItem = (itemId: string) => grades.find(g => g.item_id === itemId);

  const pct = (grade: number, max: number) => Math.round((grade / max) * 100);

  const pctColour = (p: number) =>
    p >= 70 ? 'bg-green-100 text-green-700' : p >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';

  const renderItemRow = (item: GradeItem & { weight?: number; extra_credit?: boolean }) => {
    const grade = getGradeForItem(item.item_id);
    const p = grade?.grade != null ? pct(grade.grade, item.max_grade) : null;
    return (
      <tr key={item.item_id} className="hover:bg-gray-50">
        <td className="px-6 py-3 text-sm text-gray-900 pl-10">
          {item.name}
          {item.extra_credit && <span className="ml-2 text-xs text-purple-600">(extra credit)</span>}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500 capitalize">{item.source_type}</td>
        <td className="px-4 py-3 text-sm text-gray-500">{item.max_grade}</td>
        <td className="px-4 py-3 text-sm font-medium">
          {grade?.grade != null ? grade.grade : '—'}
        </td>
        <td className="px-4 py-3 text-sm">
          {p !== null ? (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${pctColour(p)}`}>
              {p}%
            </span>
          ) : '—'}
        </td>
        {item.weight !== undefined && (
          <td className="px-4 py-3 text-sm text-gray-400">{item.weight}×</td>
        )}
      </tr>
    );
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Grades</h1>
          <p className="text-gray-500 mt-1">Your grades and performance across courses</p>
        </div>
        {courseList.length > 1 && (
          <select
            value={activeCourseId ?? ''}
            onChange={e => setSelectedCourseId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {courseList.map(c => (
              <option key={c.course_id} value={c.course_id}>{c.course_code} – {c.title}</option>
            ))}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : !activeCourse ? (
        <div className="text-center py-16 text-gray-500">
          No grade data available. Enrol in a course to see grades.
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">{activeCourse.title}</h2>

          {/* Category tree */}
          {topLevelCategories.length > 0 && topLevelCategories.map((cat: GradeCategory) => {
            const catItems = getItemsForCategory(cat.category_id);
            const subCats = categories.filter(c => c.parent_id === cat.category_id);

            const allItems = [
              ...catItems,
              ...subCats.flatMap(sc => getItemsForCategory(sc.category_id)),
            ];
            const gradedItems = allItems.filter(i => getGradeForItem(i.item_id)?.grade != null);
            const avgPct = gradedItems.length > 0
              ? Math.round(gradedItems.reduce((sum, i) => {
                  const g = getGradeForItem(i.item_id);
                  return sum + (g?.grade != null ? (g.grade / i.max_grade) * 100 : 0);
                }, 0) / gradedItems.length)
              : null;

            return (
              <div key={cat.category_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">{cat.name}</h3>
                    <p className="text-xs text-gray-500">
                      {cat.aggregation_strategy.replace('_', ' ')} · {cat.weight}% of total
                    </p>
                  </div>
                  {avgPct !== null && (
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${pctColour(avgPct)}`}>
                      ~{avgPct}%
                    </span>
                  )}
                </div>
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Max</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {catItems.map(renderItemRow)}
                    {subCats.map(sc => {
                      const scItems = getItemsForCategory(sc.category_id);
                      return (
                        <React.Fragment key={sc.category_id}>
                          <tr className="bg-gray-50">
                            <td colSpan={5} className="px-6 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                              ↳ {sc.name}
                            </td>
                          </tr>
                          {scItems.map(renderItemRow)}
                        </React.Fragment>
                      );
                    })}
                    {catItems.length === 0 && subCats.every(sc => getItemsForCategory(sc.category_id).length === 0) && (
                      <tr><td colSpan={5} className="px-6 py-4 text-sm text-gray-400 text-center">No items in this category</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })}

          {/* Uncategorised items */}
          {uncategorisedItems.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="font-semibold text-gray-800">Other Items</h3>
              </div>
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Max</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {uncategorisedItems.map(renderItemRow)}
                </tbody>
              </table>
            </div>
          )}

          {items.length === 0 && (
            <div className="text-center py-16 text-gray-500">No grade items yet for this course.</div>
          )}
        </div>
      )}
    </div>
  );
}

