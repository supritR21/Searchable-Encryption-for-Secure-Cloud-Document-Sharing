'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/auth-context';
import { Navbar } from '../../components/layout/Navbar';
import {
  LayoutDashboard,
  FileText,
  Search,
  Share2,
  FolderLock,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/documents', label: 'Documents', icon: FileText },
  { href: '/dashboard/search', label: 'Encrypted Search', icon: Search },
  { href: '/dashboard/shared', label: 'Shared with Me', icon: Share2 },
  { href: '/dashboard/workspaces', label: 'Workspaces', icon: FolderLock },
  { href: '/dashboard/security', label: 'Security & Audit', icon: ShieldCheck },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, privateKey, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center text-sm text-slate-500">Initializing cryptographic session...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      {!privateKey && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-800">
          <AlertTriangle className="inline h-3.5 w-3.5 mr-1 text-amber-600" />
          <span>Your private key is locked. Please <Link href="/login" className="font-semibold underline">re-authenticate</Link> to decrypt documents and search indices.</span>
        </div>
      )}

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 border-r border-slate-200 bg-white p-4 hidden md:block">
          <div className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            CipherShare Workspace
          </div>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6 sm:p-8 max-w-6xl">{children}</main>
      </div>
    </div>
  );
}
