'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/auth/auth-context';
import { Shield, Lock, FileText, Search, Users, LogOut, KeyRound } from 'lucide-react';

export function Navbar() {
  const { user, privateKey, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
        <Link href="/" className="flex items-center space-x-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <Shield className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">
            Cipher<span className="text-blue-600">Share</span>
          </span>
        </Link>

        {user ? (
          <div className="flex items-center space-x-4">
            <div className="hidden items-center space-x-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 md:flex">
              <Lock className="h-3.5 w-3.5 text-emerald-600" />
              <span>{privateKey ? 'Crypto Session Active' : 'Key Locked'}</span>
            </div>

            <div className="text-sm font-medium text-slate-700">{user.email}</div>

            <button
              onClick={logout}
              className="inline-flex items-center space-x-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            <Link
              href="/login"
              className="rounded-md px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 transition"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center space-x-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition"
            >
              <KeyRound className="h-4 w-4" />
              <span>Get Started</span>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
