'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../lib/auth/auth-context';
import { api } from '../../../lib/api/client';
import {
  WorkspaceSummary,
  DocumentSummary,
  DocumentMetadata,
  generateRandomBytes,
  encryptDocument,
  encryptMetadata,
  decryptDocument,
  decryptMetadata,
  wrapKeyForRecipient,
  unwrapKeyForUser,
  generateDocumentTokens,
  uint8ArrayToBase64,
  base64ToUint8Array,
  importPublicKey,
} from '@ciphershare/shared';
import { extractDocumentText, prepareDocumentMetadata } from '../../../lib/document/pdf-processing';
import {
  FileText,
  Upload,
  Download,
  Share2,
  Trash2,
  Loader2,
  Lock,
  AlertCircle,
  CheckCircle2,
  FolderLock,
} from 'lucide-react';

interface DecryptedDocItem {
  id: string;
  workspaceId: string;
  ownerId: string;
  metadata: DocumentMetadata | null;
  fileNonce: string;
  wrappedDek: string;
  permission?: string;
  createdAt: string;
}

export default function DocumentsPage() {
  const { user, privateKey, publicKey, getWorkspaceSearchKey, setWorkspaceSearchKey } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [selectedWsId, setSelectedWsId] = useState<string>('');
  const [documents, setDocuments] = useState<DecryptedDocItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sharing modal state
  const [sharingDoc, setSharingDoc] = useState<DecryptedDocItem | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  // Load workspaces
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

  // Ensure workspace search key is unlocked in client memory
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

  // Load documents for selected workspace and decrypt metadata locally
  useEffect(() => {
    if (!selectedWsId || !privateKey) return;

    async function loadDocuments() {
      setIsLoadingDocs(true);
      setError(null);
      try {
        const res = await api.get<DocumentSummary[]>(`/workspaces/${selectedWsId}/documents`);

        const decryptedList: DecryptedDocItem[] = [];

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
            console.warn(`Failed to decrypt metadata for doc ${doc.id}:`, e);
          }

          decryptedList.push({
            id: doc.id,
            workspaceId: doc.workspaceId,
            ownerId: doc.ownerId,
            metadata,
            fileNonce: doc.fileNonce,
            wrappedDek: doc.wrappedDek || '',
            permission: doc.permission,
            createdAt: doc.createdAt,
          });
        }

        setDocuments(decryptedList);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoadingDocs(false);
      }
    }

    loadDocuments();
  }, [selectedWsId, privateKey]);

  // Handle local encryption and upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedWsId || !privateKey || !publicKey) return;

    setIsUploading(true);
    setUploadStatus('1/5 Extracting document text locally...');
    setError(null);

    try {
      // 1. Text extraction
      const extractedText = await extractDocumentText(file);

      // 2. Obtain workspace search key
      setUploadStatus('2/5 Unlocking workspace search key...');
      const wsSearchKey = await getOrUnlockSearchKey(selectedWsId);
      if (!wsSearchKey) {
        throw new Error('Workspace search key not available in client memory');
      }

      // 3. Generate HMAC search tokens
      setUploadStatus('3/5 Computing HMAC-SHA-256 search tokens...');
      const searchTokens = await generateDocumentTokens(wsSearchKey, selectedWsId, extractedText);

      // 4. Generate random 256-bit DEK and encrypt document with AES-GCM + AAD
      setUploadStatus('4/5 Encrypting document with AES-256-GCM...');
      const documentId = crypto.randomUUID();
      const dek = generateRandomBytes(32);
      const fileBytes = new Uint8Array(await file.arrayBuffer());

      const { ciphertext, nonce: fileNonce } = await encryptDocument(
        fileBytes,
        dek,
        selectedWsId,
        documentId
      );

      // 5. Encrypt metadata with separate nonce
      const metadata = prepareDocumentMetadata(file);
      const { encryptedMetadata, nonce: metaNonce } = await encryptMetadata(metadata, dek);

      // 6. Wrap DEK with owner RSA-OAEP public key
      const wrappedDek = await wrapKeyForRecipient(publicKey, dek);

      // 7. Multipart upload
      setUploadStatus('5/5 Uploading ciphertext & search tokens to cloud...');
      const formData = new FormData();
      formData.append('documentId', documentId);
      formData.append('workspaceId', selectedWsId);
      formData.append('encryptedMetadata', uint8ArrayToBase64(encryptedMetadata));
      formData.append('fileNonce', uint8ArrayToBase64(fileNonce));
      formData.append('metadataNonce', uint8ArrayToBase64(metaNonce));
      formData.append('wrappedDek', uint8ArrayToBase64(wrappedDek));
      formData.append('searchTokens', JSON.stringify(searchTokens));
      formData.append('file', new Blob([ciphertext as any]), 'ciphertext.bin');

      await api.post(`/workspaces/${selectedWsId}/documents`, formData);

      // Refresh document list
      setDocuments((prev) => [
        {
          id: documentId,
          workspaceId: selectedWsId,
          ownerId: user?.id || '',
          metadata,
          fileNonce: uint8ArrayToBase64(fileNonce),
          wrappedDek: uint8ArrayToBase64(wrappedDek),
          permission: 'OWNER',
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);

      setUploadStatus(null);
    } catch (err) {
      setError((err as Error).message || 'Document upload failed');
      setUploadStatus(null);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Download and local decryption
  const handleDownload = async (doc: DecryptedDocItem) => {
    if (!privateKey) {
      setError('Private key is locked');
      return;
    }

    try {
      // 1. Download ciphertext
      const { blob, fileNonce } = await api.downloadBinary(`/documents/${doc.id}/content`);
      const ciphertext = new Uint8Array(await blob.arrayBuffer());

      // 2. Unwrap DEK locally
      const dek = await unwrapKeyForUser(privateKey, base64ToUint8Array(doc.wrappedDek));

      // 3. Decrypt document locally and verify GCM tag + AAD
      const nonceBytes = base64ToUint8Array(fileNonce || doc.fileNonce);
      const plaintextBytes = await decryptDocument(
        ciphertext,
        nonceBytes,
        dek,
        doc.workspaceId,
        doc.id
      );

      // 4. Trigger download
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

  // Delete document
  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.delete(`/documents/${docId}`);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Handle document sharing
  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sharingDoc || !privateKey) return;
    setShareStatus('Searching recipient and loading public key...');

    try {
      // 1. Find recipient user
      const usersRes = await api.get<any[]>(`/users/search?email=${encodeURIComponent(shareEmail)}`);
      if (usersRes.data.length === 0) {
        throw new Error('User not found with this email');
      }
      const recipient = usersRes.data[0];

      // 2. Unwrap document DEK with owner private key
      setShareStatus('Unwrapping document DEK locally...');
      const dek = await unwrapKeyForUser(privateKey, base64ToUint8Array(sharingDoc.wrappedDek));

      // 3. Import recipient public key & wrap DEK
      setShareStatus('Wrapping DEK with recipient RSA-OAEP public key...');
      const recipientPubKey = await importPublicKey(base64ToUint8Array(recipient.publicKeySpki));
      const recipientWrappedDek = await wrapKeyForRecipient(recipientPubKey, dek);

      // 4. Submit share request
      setShareStatus('Submitting encrypted access envelope to Express...');
      await api.post(`/documents/${sharingDoc.id}/share`, {
        recipientUserId: recipient.id,
        encryptedDek: uint8ArrayToBase64(recipientWrappedDek),
        permission: 'READ',
      });

      setShareStatus('Document successfully shared with recipient!');
      setTimeout(() => {
        setSharingDoc(null);
        setShareStatus(null);
        setShareEmail('');
      }, 1500);
    } catch (err) {
      setShareStatus(`Error: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Encrypted Documents</h1>
          <p className="text-sm text-slate-600">
            Files are encrypted with AES-256-GCM before upload &bull; Searchable via HMAC-SHA-256 tokens
          </p>
        </div>

        {/* Workspace selector */}
        <div className="flex items-center space-x-2">
          <FolderLock className="h-4 w-4 text-slate-500" />
          <select
            value={selectedWsId}
            onChange={(e) => setSelectedWsId(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                Workspace ({ws.role || 'Member'}) - {ws.id.substring(0, 8)}...
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center space-x-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Box */}
      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center hover:border-blue-500 transition">
        <Upload className="mx-auto h-8 w-8 text-slate-400 mb-2" />
        <h3 className="text-sm font-semibold text-slate-900">Upload PDF or TXT Document</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Keywords will be normalized and indexed with HMAC-SHA-256. Max file size: 10 MB.
        </p>

        <div className="mt-4">
          <label className="cursor-pointer inline-flex items-center space-x-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition">
            <Lock className="h-4 w-4" />
            <span>Select File to Encrypt & Upload</span>
            <input
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              disabled={isUploading}
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {isUploading && (
          <div className="mt-4 flex items-center justify-center space-x-2 text-xs font-medium text-blue-700 bg-blue-50 py-2 rounded">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span>{uploadStatus}</span>
          </div>
        )}
      </div>

      {/* Document Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Workspace Documents ({documents.length})
          </h2>
          {isLoadingDocs && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
        </div>

        {documents.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No documents in this workspace yet. Upload a PDF or TXT document above!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Document Name (Decrypted)</th>
                  <th className="px-6 py-3">Size</th>
                  <th className="px-6 py-3">Permission</th>
                  <th className="px-6 py-3">Uploaded</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 font-medium text-slate-900 flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <span>{doc.metadata?.originalName || `[Encrypted File: ${doc.id.substring(0, 8)}...]`}</span>
                    </td>
                    <td className="px-6 py-4">
                      {doc.metadata ? `${(doc.metadata.sizeBytes / 1024).toFixed(1)} KB` : 'Encrypted'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                        {doc.permission || 'READ'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleDownload(doc)}
                        title="Download and decrypt file"
                        className="p-1.5 text-slate-600 hover:text-blue-600 rounded hover:bg-slate-100 transition"
                      >
                        <Download className="h-4 w-4" />
                      </button>

                      {doc.permission === 'OWNER' && (
                        <>
                          <button
                            onClick={() => setSharingDoc(doc)}
                            title="Share with workspace user"
                            className="p-1.5 text-slate-600 hover:text-purple-600 rounded hover:bg-slate-100 transition"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            title="Delete document"
                            className="p-1.5 text-slate-600 hover:text-red-600 rounded hover:bg-slate-100 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sharing Modal */}
      {sharingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Share Document Access</h3>
            <p className="text-xs text-slate-500 mb-4">
              Re-wraps the document DEK using the recipient&apos;s 3072-bit RSA-OAEP public key.
            </p>

            <form onSubmit={handleShareSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600">
                  Recipient Email
                </label>
                <input
                  type="email"
                  required
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  placeholder="bob@ciphershare.io"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              {shareStatus && (
                <div className="text-xs font-medium text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200">
                  {shareStatus}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSharingDoc(null);
                    setShareStatus(null);
                  }}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-purple-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-purple-700"
                >
                  Share DEK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
