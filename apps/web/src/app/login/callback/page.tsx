'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setAccessToken } from '@/lib/api';
import { useAuth } from '@/lib/providers';

function OidcCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuthenticated } = useAuth();
  const [status, setStatus] = useState<'processing' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const error = searchParams.get('error');

    if (error) {
      setErrorMessage(`SSO login failed: ${error.replace(/_/g, ' ')}`);
      setStatus('error');
      return;
    }

    if (!accessToken || !refreshToken) {
      setErrorMessage('SSO login failed: missing tokens in callback.');
      setStatus('error');
      return;
    }

    // Store tokens and mark the session as authenticated
    setAccessToken(accessToken);
    if (typeof window !== 'undefined') {
      localStorage.setItem('refreshToken', refreshToken);
    }
    setAuthenticated(true);
    router.replace('/dashboard');
  }, [searchParams, router, setAuthenticated]);

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-xl mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Sign-in failed</h1>
          <p className="text-gray-500 text-sm mb-6">{errorMessage}</p>
          <a
            href="/login"
            className="inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl mb-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Completing sign-in…</h1>
        <p className="text-gray-500 text-sm">Please wait while we set up your session.</p>
      </div>
    </div>
  );
}

/**
 * OIDC callback page.
 * The API backend redirects here after a successful OIDC login with
 * `?accessToken=...&refreshToken=...` query parameters.
 *
 * useSearchParams() requires a Suspense boundary in Next.js 15.
 */
export default function OidcCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
          </div>
        </div>
      }
    >
      <OidcCallbackInner />
    </Suspense>
  );
}
