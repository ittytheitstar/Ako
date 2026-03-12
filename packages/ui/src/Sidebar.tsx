'use client';
import React, { useState } from 'react';

export interface SidebarItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  active?: boolean;
  badge?: string;
}

export interface SidebarSection {
  title?: string;
  items: SidebarItem[];
}

export interface SidebarProps {
  sections: SidebarSection[];
  header?: React.ReactNode;
  footer?: React.ReactNode;
  collapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sections,
  header,
  footer,
  collapsed: controlledCollapsed,
  onToggle,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;

  const toggle = () => {
    const next = !collapsed;
    setInternalCollapsed(next);
    onToggle?.(next);
  };

  return (
    <aside className={`flex flex-col bg-gray-900 text-white transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'} h-full`}>
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700">
        {!collapsed && <div className="flex-1 overflow-hidden">{header}</div>}
        <button onClick={toggle} className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors" aria-label="Toggle sidebar">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsed ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
          </svg>
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        {sections.map((section, idx) => (
          <div key={idx} className="mb-4">
            {section.title && !collapsed && (
              <p className="px-4 mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">{section.title}</p>
            )}
            {section.items.map((item, itemIdx) => (
              <a
                key={itemIdx}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                  item.active ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
                title={collapsed ? item.label : undefined}
              >
                {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                {!collapsed && item.badge && (
                  <span className="ml-auto bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">{item.badge}</span>
                )}
              </a>
            ))}
          </div>
        ))}
      </nav>
      {footer && !collapsed && (
        <div className="border-t border-gray-700 p-4">{footer}</div>
      )}
    </aside>
  );
};
