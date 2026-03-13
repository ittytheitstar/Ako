'use client';
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/providers';
import { logout } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.getMe(),
    enabled: isAuthenticated,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: '⊞' },
    { label: 'Courses', href: '/dashboard/courses', icon: '📚' },
    { label: 'Past Courses', href: '/dashboard/courses/archived', icon: '📦' },
    { label: 'Forums', href: '/dashboard/forums', icon: '💬' },
    { label: 'Assignments', href: '/dashboard/assignments', icon: '📝' },
    { label: 'Grades', href: '/dashboard/grades', icon: '📊' },
    { label: 'Messages', href: '/dashboard/messages', icon: '✉' },
    { label: 'Reports', href: '/dashboard/reports', icon: '📈' },
    { label: 'Archive', href: '/dashboard/admin/archive', icon: '🗄' },
    { label: 'Retention', href: '/dashboard/admin/retention', icon: '📋' },
    { label: 'Compliance', href: '/dashboard/admin/compliance', icon: '🛡' },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 flex flex-col flex-shrink-0">
        <div className="px-6 py-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">A</span>
            </div>
            <span className="text-white font-semibold text-lg">Ako LMS</span>
          </div>
        </div>
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-2.5 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors text-sm"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        {me && (
          <div className="border-t border-gray-700 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {me.display_name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{me.display_name}</p>
                <p className="text-gray-400 text-xs truncate">{me.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full text-left text-gray-400 hover:text-white text-sm transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
