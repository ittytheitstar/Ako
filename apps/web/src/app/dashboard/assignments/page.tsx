'use client';
import React from 'react';

export default function AssignmentsPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Assignments</h1>
        <p className="text-gray-500 mt-1">View and submit your assignments</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
        Navigate to a course to view and submit assignments.
      </div>
    </div>
  );
}
