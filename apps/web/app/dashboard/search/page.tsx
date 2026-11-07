'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../lib/auth/auth-context';
import { api } from '../../../lib/api/client';
import {
  WorkspaceSummary,
  SearchResultItem,
  DocumentMetadata,
  generateQueryTokens,
  decryptMetadata,
  decryptDocument,
  unwrapKeyForUser,
  base64ToUint8Array,
} from '@ciphershare/shared';
import {
  Search,
  Lock,
  Download,
  Loader2,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  FolderLock,
} from 'lucide-react';

interface DecryptedResultItem {
  id: string;
  workspaceId: string;
  ownerId: string;
  metadata: DocumentMetadata | null;
  fileNonce: string;
  wrappedDek: string;
  permission: string;
  createdAt: string;
}

export default function SearchPage() {
  const { privateKey, getWorkspaceSearchKey, setWorkspaceSearchKey } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [selectedWsId, setSelectedWsId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'AND' | 'SINGLE'>('AND');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<DecryptedResultItem[]>([]);
  const [searchStats, setSearchStats] = useState<{ count: number; durationMs: number; tokens: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWorkspaces() {
      try {
        const res = await api.get<WorkspaceSummary[]>('/workspaces');
        setWorkspaces(res.data);
        if (res.data.length > 0) {
          setSelectedWsId(res.data[0].id);
        }
      } catch (err) {
        setError('Failed to load workspaces');
      }
    }
    fetchWorkspaces();
  }, []);

  const getOrUnlockSearchKey = async (wsId: string): Promise<Uint8Array | null> => {
    const cached = getWorkspaceSearchKey(wsId);
    if (cached) return cached;

    const ws = workspaces.find((w) => w.id === wsId);
    if (!ws || !ws.wrappedSearchKey || !privateKey) return null;

    try {
      const wrappedBytes = base64ToUint8Array(ws.wrappedSearchKey);
      const unlockedKey = await unwrapKeyForUser(privateKey, wrappedBytes);
      setWorkspaceSearchKey(wsId, unlockedKey);
      return unlockedKey;
    } catch (err) {
      console.error('Failed to unwrap workspace search key:', err);
      return null;
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !selectedWsId || !privateKey) return;

    setIsSearching(true);
    setError(null);
    setSearchStats(null);

    const clientStartTime = performance.now();

    try {
      // 1. Obtain workspace search key
      const wsSearchKey = await getOrUnlockSearchKey(selectedWsId);
      if (!wsSearchKey) {
        throw new Error('Workspace search key is not available in client memory');
      }

      // 2. Generate HMAC search tokens locally
      const tokens = await generateQueryTokens(wsSearchKey, selectedWsId, query);
      if (tokens.length === 0) {
        throw new Error('No searchable alphanumeric terms found in query');
      }

      // 3. Send ONLY tokens to Express (never plaintext query!)
      const searchRes = await api.post<{
        documents: SearchResultItem[];
        totalMatches: number;
        searchDurationMs: number;
      }>(`/workspaces/${selectedWsId}/search`, {
        tokens,
        mode,
      });

      // 4. Decrypt metadata for matched documents locally
      const decryptedResults: DecryptedResultItem[] = [];
      for (const doc of searchRes.data.documents) {
        let metadata: DocumentMetadata | null = null;
        try {
          if (doc.wrappedDek) {
            const dek = await unwrapKeyForUser(privateKey, base64ToUint8Array(doc.wrappedDek));
            const metaBytes = base64ToUint8Array(doc.encryptedMetadata);
            const metaNonce = base64ToUint8Array(doc.metadataNonce);
            metadata = await decryptMetadata(metaBytes, metaNonce, dek);
          }
        } catch (e) {
          console.warn(`Failed to decrypt metadata for doc ${doc.id}:`, e);
        }

        decryptedResults.push({
          id: doc.id,
          workspaceId: doc.workspaceId,
          ownerId: doc.ownerId,
          metadata,
          fileNonce: '',
          wrappedDek: doc.wrappedDek,
          permission: doc.permission,
          createdAt: doc.createdAt,
        });
      }

      const totalClientDurationMs = performance.now() - clientStartTime;

      setResults(decryptedResults);
      setSearchStats({
        count: searchRes.data.documents.length,
        durationMs: Math.round(totalClientDurationMs * 100) / 100,
        tokens,
      });
    } catch (err) {
      setError((err as Error).message || 'Search execution failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDownload = async (doc: DecryptedResultItem) => {
    if (!privateKey) return;
    try {
      const { blob, fileNonce } = await api.downloadBinary(`/documents/${doc.id}/content`);
      const ciphertext = new Uint8Array(await blob.arrayBuffer());
      const dek = await unwrapKeyForUser(privateKey, base64ToUint8Array(doc.wrappedDek));
      const nonceBytes = base64ToUint8Array(fileNonce);
      const plaintextBytes = await decryptDocument(
        ciphertext,
        nonceBytes,
        dek,
        doc.workspaceId,
        doc.id
      );

      const mime = doc.metadata?.mimeType || 'application/octet-stream';
      const filename = doc.metadata?.originalName || `document_${doc.id}.pdf`;
      const decryptedBlob = new Blob([plaintextBytes as any], { type: mime });
      const downloadUrl = URL.createObjectURL(decryptedBlob);

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(`Decryption failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Searchable Encryption</h1>
        <p className="text-sm text-slate-600">
          Evaluates inverted index tokens in the cloud &bull; Zero plaintext search terms transmitted
        </p>
      </div>

      {error && (
        <div className="flex items-center space-x-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Input Box */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                required
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter search keywords (e.g. cryptography report)..."
                className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
              />
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            </div>

            <div className="flex items-center space-x-2">
              <FolderLock className="h-4 w-4 text-slate-500" />
              <select
                value={selectedWsId}
                onChange={(e) => setSelectedWsId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    Workspace: {ws.id.substring(0, 8)}...
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="inline-flex items-center space-x-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Computing HMAC & Searching...</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Generate Trapdoors & Search</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center space-x-6 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Search Semantics:</span>
            <label className="flex items-center space-x-1.5 cursor-pointer">
              <input
                type="radio"
                name="searchMode"
                value="AND"
                checked={mode === 'AND'}
                onChange={() => setMode('AND')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span>Multi-Keyword AND (Contains all tokens)</span>
            </label>
            <label className="flex items-center space-x-1.5 cursor-pointer">
              <input
                type="radio"
                name="searchMode"
                value="SINGLE"
                checked={mode === 'SINGLE'}
                onChange={() => setMode('SINGLE')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span>Single Keyword (Any token match)</span>
            </label>
          </div>
        </form>

        {/* Cryptographic Inspector */}
        {searchStats && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1 text-emerald-700 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Found {searchStats.count} authorized document(s)</span>
              </span>
              <span className="flex items-center space-x-1">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>End-to-End Latency: {searchStats.durationMs} ms</span>
              </span>
            </div>
            <div className="text-slate-400 font-mono text-[11px]">
              Opaque Tokens Sent: {searchStats.tokens.length} ({searchStats.tokens[0]?.substring(0, 12)}...)
            </div>
          </div>
        )}
      </div>

      {/* Results List */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Search Matches ({results.length})
          </h2>
        </div>

        {results.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {searchStats ? 'No matching documents found for this query.' : 'Submit a search query above to inspect matching documents.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {results.map((doc) => (
              <div key={doc.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition">
                <div className="flex items-center space-x-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900">
                      {doc.metadata?.originalName || `[Encrypted Document ${doc.id.substring(0, 8)}...]`}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {doc.metadata ? `${(doc.metadata.sizeBytes / 1024).toFixed(1)} KB` : 'Encrypted'} &bull; Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleDownload(doc)}
                  className="inline-flex items-center space-x-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  <Download className="h-3.5 w-3.5 text-slate-500" />
                  <span>Download & Decrypt</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
