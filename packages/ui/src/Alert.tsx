import React from 'react';

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const styles: Record<NonNullable<AlertProps['variant']>, { container: string; icon: string }> = {
  info: { container: 'bg-blue-50 border-blue-200 text-blue-800', icon: 'ℹ' },
  success: { container: 'bg-green-50 border-green-200 text-green-800', icon: '✓' },
  warning: { container: 'bg-yellow-50 border-yellow-200 text-yellow-800', icon: '⚠' },
  error: { container: 'bg-red-50 border-red-200 text-red-800', icon: '✕' },
};

export const Alert: React.FC<AlertProps> = ({ variant = 'info', title, children, className = '' }) => {
  const s = styles[variant];
  return (
    <div className={`flex gap-3 p-4 rounded-lg border ${s.container} ${className}`} role="alert">
      <span className="flex-shrink-0 font-bold">{s.icon}</span>
      <div>
        {title && <p className="font-semibold text-sm mb-1">{title}</p>}
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
};
