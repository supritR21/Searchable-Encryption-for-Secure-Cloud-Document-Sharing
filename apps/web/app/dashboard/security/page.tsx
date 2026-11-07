'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api/client';
import {
  ShieldCheck,
  Lock,
  Key,
  Database,
  Cpu,
  AlertTriangle,
  History,
  FileCheck,
} from 'lucide-react';
import { CRYPTO_CONSTANTS } from '@ciphershare/shared';

export default function SecurityDashboardPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await api.get<any[]>('/audit/logs');
        setLogs(res.data);
      } catch (err) {
        console.warn('Failed to load audit logs:', err);
      } finally {
        setIsLoadingLogs(false);
      }
    }
    fetchLogs();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Security & Cryptographic Specifications
        </h1>
        <p className="text-sm text-slate-600">
          Formal primitives, key management parameters, leakage profile, and operational audit log
        </p>
      </div>

      {/* Primitives Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center space-x-2 text-blue-600 mb-3">
            <Lock className="h-5 w-5" />
            <h3 className="text-base font-bold text-slate-900">Symmetric Document Encryption</h3>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <dt className="text-slate-500 font-medium">Algorithm</dt>
              <dd className="font-mono text-slate-900 mt-0.5">{CRYPTO_CONSTANTS.AES_GCM.ALGORITHM}-256</dd>
            </div>
            <div>
              <dt className="text-slate-500 font-medium">Key Length</dt>
              <dd className="font-mono text-slate-900 mt-0.5">256 bits (32 bytes random DEK)</dd>
            </div>
            <div>
              <dt className="text-slate-500 font-medium">Nonce / IV Length</dt>
              <dd className="font-mono text-slate-900 mt-0.5">96 bits (12 bytes unique per op)</dd>
            </div>
            <div>
              <dt className="text-slate-500 font-medium">Authentication Tag</dt>
              <dd className="font-mono text-slate-900 mt-0.5">128 bits (GCM verified)</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500 font-medium">Additional Authenticated Data (AAD)</dt>
              <dd className="font-mono text-slate-900 mt-0.5 bg-slate-50 p-2 rounded text-[11px]">
                ciphershare-aad|v1|{'{workspaceId}'}|{'{documentId}'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center space-x-2 text-purple-600 mb-3">
            <Key className="h-5 w-5" />
            <h3 className="text-base font-bold text-slate-900">Asymmetric Key Wrapping</h3>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <dt className="text-slate-500 font-medium">Algorithm</dt>
              <dd className="font-mono text-slate-900 mt-0.5">{CRYPTO_CONSTANTS.RSA.ALGORITHM}</dd>
            </div>
            <div>
              <dt className="text-slate-500 font-medium">Modulus Length</dt>
              <dd className="font-mono text-slate-900 mt-0.5">3072 bits</dd>
            </div>
            <div>
              <dt className="text-slate-500 font-medium">Hash Function</dt>
              <dd className="font-mono text-slate-900 mt-0.5">SHA-256 (MGF1-SHA-256)</dd>
            </div>
            <div>
              <dt className="text-slate-500 font-medium">Public Exponent</dt>
              <dd className="font-mono text-slate-900 mt-0.5">65537 (0x010001)</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500 font-medium">Private-Key Storage Protection</dt>
              <dd className="font-mono text-slate-900 mt-0.5 bg-slate-50 p-2 rounded text-[11px]">
                Argon2id (64MB, t=3, p=1) &rarr; AES-256-GCM encrypted PKCS8
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center space-x-2 text-emerald-600 mb-3">
            <Cpu className="h-5 w-5" />
            <h3 className="text-base font-bold text-slate-900">Searchable Symmetric Encryption (SSE)</h3>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <dt className="text-slate-500 font-medium">Trapdoor Construction</dt>
              <dd className="font-mono text-slate-900 mt-0.5">HMAC-SHA-256</dd>
            </div>
            <div>
              <dt className="text-slate-500 font-medium">Trapdoor Output Length</dt>
              <dd className="font-mono text-slate-900 mt-0.5">256 bits (32 bytes)</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500 font-medium">Token Derivation Formula</dt>
              <dd className="font-mono text-slate-900 mt-0.5 bg-slate-50 p-2 rounded text-[11px]">
                T = HMAC-SHA-256(workspaceSearchKey, &quot;ciphershare|&quot; + workspaceId + &quot;|&quot; + normalizedKeyword)
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500 font-medium">Normalization Pipeline</dt>
              <dd className="text-slate-700 mt-0.5">
                Unicode NFC &bull; lowercase conversion &bull; alphanumeric token extraction &bull; deduplication
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center space-x-2 text-amber-600 mb-3">
            <Database className="h-5 w-5" />
            <h3 className="text-base font-bold text-slate-900">Cloud Storage Architecture</h3>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <dt className="text-slate-500 font-medium">Storage Engine</dt>
              <dd className="font-mono text-slate-900 mt-0.5">PostgreSQL 16</dd>
            </div>
            <div>
              <dt className="text-slate-500 font-medium">Ciphertext Column Type</dt>
              <dd className="font-mono text-slate-900 mt-0.5">BYTEA (binary)</dd>
            </div>
            <div>
              <dt className="text-slate-500 font-medium">Max Document Size</dt>
              <dd className="font-mono text-slate-900 mt-0.5">10 MB</dd>
            </div>
            <div>
              <dt className="text-slate-500 font-medium">Max Terms / Document</dt>
              <dd className="font-mono text-slate-900 mt-0.5">2000 terms</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500 font-medium">Search Inverted Index</dt>
              <dd className="font-mono text-slate-900 mt-0.5 bg-slate-50 p-2 rounded text-[11px]">
                INDEX on search_index(workspace_id, key_version, search_token)
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Threat Model Boundaries and Leakage Analysis */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6">
        <div className="flex items-center space-x-2 text-amber-800 font-bold text-sm mb-2">
          <AlertTriangle className="h-4 w-4" />
          <span>Threat Model Boundaries & Searchable Encryption Leakage Profile</span>
        </div>
        <p className="text-xs text-amber-900 leading-relaxed mb-3">
          CipherShare operates under the standard <strong>honest-but-curious</strong> cloud security model. In accordance with Applied Cryptography research standards, we document the precise security boundaries and leakage channels:
        </p>
        <ul className="space-y-1.5 text-xs text-amber-800 list-disc list-inside">
          <li><strong>Search Pattern Leakage:</strong> Submitting repeated queries for the same keyword produces deterministic HMAC tokens, allowing the cloud to observe query repetitions.</li>
          <li><strong>Access Pattern Leakage:</strong> The cloud database learns which encrypted document IDs match a given search token.</li>
          <li><strong>Size & Volume Leakage:</strong> The cloud observes approximate ciphertext byte lengths and keyword frequency distributions.</li>
          <li><strong>Client Trust Boundary:</strong> Security guarantees assume the browser execution environment and delivered scripts are uncorrupted.</li>
          <li><strong>Revocation Boundary:</strong> Document revocation prevents subsequent retrieval through the API; however, a user who previously cached a local decrypted copy retains that copy.</li>
        </ul>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="h-4 w-4 text-slate-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Operational Security Audit Log
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Zero plaintext or key leakage</span>
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {isLoadingLogs ? 'Loading audit records...' : 'No audit entries recorded yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">Target Scope</th>
                  <th className="px-6 py-3">Details (Sanitized)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-3 font-mono text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 font-semibold text-slate-900">
                      {log.action}
                    </td>
                    <td className="px-6 py-3 font-mono text-slate-600">
                      {log.documentId ? `Doc: ${log.documentId.substring(0, 8)}...` : log.workspaceId ? `WS: ${log.workspaceId.substring(0, 8)}...` : 'User Account'}
                    </td>
                    <td className="px-6 py-3 font-mono text-slate-500">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
