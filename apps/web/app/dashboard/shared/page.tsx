'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../lib/auth/auth-context';
import { api } from '../../../lib/api/client';
import {
  DocumentMetadata,
  decryptMetadata,
  decryptDocument,
  unwrapKeyForUser,
  base64ToUint8Array,
} from '@ciphershare/shared';
import {
  Share2,
  Download,
  FileText,
  Loader2,
  AlertCircle,
  UserCheck,
} from 'lucide-react';

interface SharedDocItem {
  id: string;
  workspaceId: string;
  ownerId: string;
  metadata: DocumentMetadata | null;
  fileNonce: string;
  wrappedDek: string;
  permission: string;
  createdAt: string;
  sharedBy: {
    id: string;
    email: string;
  };
}

export default function SharedPage() {
  const { privateKey } = useAuth();
  const [documents, setDocuments] = useState<SharedDocItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!privateKey) return;

    async function fetchSharedDocs() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.get<any[]>('/documents/shared-with-me');
        const decryptedList: SharedDocItem[] = [];

        for (const doc of res.data) {
          let metadata: DocumentMetadata | null = null;
          try {
            if (doc.wrappedDek) {
              const dek = await unwrapKeyForUser(privateKey!, base64ToUint8Array(doc.wrappedDek));
              const metaBytes = base64ToUint8Array(doc.encryptedMetadata);
              const metaNonce = base64ToUint8Array(doc.metadataNonce);
              metadata = await decryptMetadata(metaBytes, metaNonce, dek);
            }
          } catch (e) {
            console.warn(`Failed to decrypt shared metadata for doc ${doc.id}:`, e);
          }

          decryptedList.push({
            id: doc.id,
            workspaceId: doc.workspaceId,
            ownerId: doc.ownerId,
            metadata,
            fileNonce: doc.fileNonce,
            wrappedDek: doc.wrappedDek,
            permission: doc.permission,
            createdAt: doc.createdAt,
            sharedBy: doc.sharedBy,
          });
        }

        setDocuments(decryptedList);
      } catch (err) {
        setError((err as Error).message || 'Failed to fetch shared documents');
      } finally {
        setIsLoading(false);
      }
    }

    fetchSharedDocs();
  }, [privateKey]);

  const handleDownload = async (doc: SharedDocItem) => {
    if (!privateKey) return;
    try {
      const { blob, fileNonce } = await api.downloadBinary(`/documents/${doc.id}/content`);
      const ciphertext = new Uint8Array(await blob.arrayBuffer());
      const dek = await unwrapKeyForUser(privateKey, base64ToUint8Array(doc.wrappedDek));
      const nonceBytes = base64ToUint8Array(fileNonce || doc.fileNonce);
      const plaintextBytes = await decryptDocument(
        ciphertext,
        nonceBytes,
        dek,
        doc.workspaceId,
        doc.id
      );

      const mime = doc.metadata?.mimeType || 'application/octet-stream';
      const filename = doc.metadata?.originalName || `shared_${doc.id}.pdf`;
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
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Shared With Me</h1>
        <p className="text-sm text-slate-600">
          Documents shared by other users via RSA-OAEP re-wrapped DEK envelopes
        </p>
      </div>

      {error && (
        <div className="flex items-center space-x-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Shared Documents ({documents.length})
          </h2>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
        </div>

        {documents.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No documents shared with you yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Document Name (Decrypted)</th>
                  <th className="px-6 py-3">Shared By</th>
                  <th className="px-6 py-3">Permission</th>
                  <th className="px-6 py-3">Date Shared</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 font-medium text-slate-900 flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-purple-600 flex-shrink-0" />
                      <span>{doc.metadata?.originalName || `[Encrypted File: ${doc.id.substring(0, 8)}...]`}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center space-x-1.5 text-slate-700">
                        <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{doc.sharedBy?.email}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700 border border-purple-200">
                        {doc.permission}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDownload(doc)}
                        className="inline-flex items-center space-x-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                      >
                        <Download className="h-3.5 w-3.5 text-slate-500" />
                        <span>Decrypt & Download</span>
                      </button>
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
