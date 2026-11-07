'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/auth/auth-context';
import { api } from '../../lib/api/client';
import {
  FileText,
  Search,
  Share2,
  FolderLock,
  ArrowRight,
  Shield,
  Clock,
} from 'lucide-react';
import { WorkspaceSummary } from '@ciphershare/shared';

export default function DashboardOverviewPage() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [stats, setStats] = useState({
    workspacesCount: 0,
    documentsCount: 0,
    sharedCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const wsRes = await api.get<WorkspaceSummary[]>('/workspaces');
        setWorkspaces(wsRes.data);

        const sharedRes = await api.get<any[]>('/documents/shared-with-me');

        let totalDocs = 0;
        for (const ws of wsRes.data) {
          const docRes = await api.get<any[]>(`/workspaces/${ws.id}/documents`);
          totalDocs += docRes.data.length;
        }

        setStats({
          workspacesCount: wsRes.data.length,
          documentsCount: totalDocs,
          sharedCount: sharedRes.data.length,
        });
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Cryptographic Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Logged in as <span className="font-semibold text-slate-800">{user?.email}</span> &bull; Client-side encryption operational
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Accessible Workspaces</span>
            <FolderLock className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-4 text-3xl font-bold text-slate-900">{stats.workspacesCount}</div>
          <div className="mt-1 text-xs text-slate-500">Workspaces holding shared search keys</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Encrypted Documents</span>
            <FileText className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="mt-4 text-3xl font-bold text-slate-900">{stats.documentsCount}</div>
          <div className="mt-1 text-xs text-slate-500">Stored as PostgreSQL BYTEA with AES-GCM</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Shared With Me</span>
            <Share2 className="h-5 w-5 text-purple-600" />
          </div>
          <div className="mt-4 text-3xl font-bold text-slate-900">{stats.sharedCount}</div>
          <div className="mt-1 text-xs text-slate-500">Accessible via RSA-OAEP wrapped DEK</div>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-blue-600 mb-2 font-semibold text-sm">
              <Search className="h-4 w-4" />
              <span>Searchable Encryption</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Query Documents Without Revealing Keywords</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Generate HMAC search tokens locally in your browser. Express searches the inverted index and returns authorized matching documents.
            </p>
          </div>
          <div className="mt-6">
            <Link
              href="/dashboard/search"
              className="inline-flex items-center space-x-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              <span>Search Documents</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-emerald-600 mb-2 font-semibold text-sm">
              <FileText className="h-4 w-4" />
              <span>Document Upload</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Client-Side File Encryption & Indexing</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Upload PDF and TXT files up to 10 MB. Files are encrypted with random 256-bit AES-GCM keys before network transmission.
            </p>
          </div>
          <div className="mt-6">
            <Link
              href="/dashboard/documents"
              className="inline-flex items-center space-x-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition"
            >
              <span>Manage Documents</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
