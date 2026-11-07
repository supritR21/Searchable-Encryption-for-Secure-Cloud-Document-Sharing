'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../lib/auth/auth-context';
import { api } from '../../../lib/api/client';
import {
  WorkspaceSummary,
  generateRandomBytes,
  wrapKeyForRecipient,
  unwrapKeyForUser,
  uint8ArrayToBase64,
  base64ToUint8Array,
  importPublicKey,
  encryptMetadata,
} from '@ciphershare/shared';
import {
  FolderLock,
  Plus,
  Users,
  UserPlus,
  Shield,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export default function WorkspacesPage() {
  const { user, privateKey, publicKey, getWorkspaceSearchKey, setWorkspaceSearchKey } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [selectedWs, setSelectedWs] = useState<WorkspaceSummary | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create workspace state
  const [isCreating, setIsCreating] = useState(false);
  const [newWsName, setNewWsName] = useState('');

  // Add member state
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [addStatus, setAddStatus] = useState<string | null>(null);

  const fetchWorkspaces = async () => {
    try {
      const res = await api.get<WorkspaceSummary[]>('/workspaces');
      setWorkspaces(res.data);
      if (res.data.length > 0 && !selectedWs) {
        setSelectedWs(res.data[0]);
      }
    } catch (err) {
      const msg = (err as Error).message || '';
      if (msg.includes('fetch') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setError(
          'Cannot connect to the CipherShare API server at http://localhost:4000. Please ensure "npm run dev:api" is running in your terminal.'
        );
      } else {
        setError(`Failed to fetch workspaces: ${msg}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    if (!selectedWs) return;
    async function fetchMembers() {
      try {
        const res = await api.get<any[]>(`/workspaces/${selectedWs!.id}/members`);
        setMembers(res.data);
      } catch (err) {
        console.warn('Failed to fetch workspace members:', err);
      }
    }
    fetchMembers();
  }, [selectedWs]);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newWsName.trim()) {
      setError('Please enter a workspace name');
      return;
    }

    setIsCreating(true);
    try {
      // Resolve public key from context or user profile
      let activePubKey = publicKey;
      if (!activePubKey && user?.publicKeySpki) {
        activePubKey = await importPublicKey(base64ToUint8Array(user.publicKeySpki));
      }

      if (!activePubKey) {
        throw new Error('Public key is not loaded in this session. Please log out and log back in.');
      }

      // 1. Generate random 32-byte workspace search key
      const wsSearchKey = generateRandomBytes(32);

      // 2. Wrap workspace search key with owner's public key
      const wrappedKey = await wrapKeyForRecipient(activePubKey, wsSearchKey);

      // 3. Encrypt workspace name with temporary AES key
      const tempKey = generateRandomBytes(32);
      const { encryptedMetadata, nonce: nameNonce } = await encryptMetadata(
        { originalName: newWsName, mimeType: 'text/plain', sizeBytes: 0, createdAt: Date.now() },
        tempKey
      );

      // 4. Create workspace
      const res = await api.post<WorkspaceSummary>('/workspaces', {
        encryptedName: uint8ArrayToBase64(encryptedMetadata),
        nameNonce: uint8ArrayToBase64(nameNonce),
        wrappedSearchKey: uint8ArrayToBase64(wrappedKey),
        keyVersion: 1,
      });

      // Cache search key in client memory
      setWorkspaceSearchKey(res.data.id, wsSearchKey);

      setWorkspaces((prev) => [res.data, ...prev]);
      setSelectedWs(res.data);
      setNewWsName('');
    } catch (err) {
      setError((err as Error).message || 'Failed to create workspace');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWs) {
      setAddStatus('No workspace selected');
      return;
    }
    if (!memberEmail.trim()) {
      setAddStatus('Please enter an email address');
      return;
    }
    if (!privateKey) {
      setAddStatus('Your private key is locked. Please log out and log back in to unlock your key session.');
      return;
    }

    setAddStatus('Searching user by email...');
    try {
      // 1. Search recipient user
      const userRes = await api.get<any[]>(`/users/search?email=${encodeURIComponent(memberEmail)}`);
      if (userRes.data.length === 0) {
        throw new Error('User not found');
      }
      const recipient = userRes.data[0];

      // 2. Obtain unlocked workspace search key
      setAddStatus('Unwrapping workspace search key with owner private key...');
      let searchKey = getWorkspaceSearchKey(selectedWs.id);
      if (!searchKey) {
        if (!selectedWs.wrappedSearchKey) throw new Error('No wrapped search key found');
        searchKey = await unwrapKeyForUser(privateKey, base64ToUint8Array(selectedWs.wrappedSearchKey));
        setWorkspaceSearchKey(selectedWs.id, searchKey);
      }

      // 3. Re-wrap workspace search key with recipient's public key
      setAddStatus('Wrapping search key with recipient RSA-OAEP public key...');
      const recipientPubKey = await importPublicKey(base64ToUint8Array(recipient.publicKeySpki));
      const wrappedForRecipient = await wrapKeyForRecipient(recipientPubKey, searchKey);

      // 4. Submit member add request
      setAddStatus('Enrolling member into workspace...');
      await api.post(`/workspaces/${selectedWs.id}/members`, {
        userId: recipient.id,
        wrappedSearchKey: uint8ArrayToBase64(wrappedForRecipient),
      });

      setAddStatus('Member successfully enrolled with search key envelope!');
      setTimeout(() => {
        setIsAddingMember(false);
        setAddStatus(null);
        setMemberEmail('');
      }, 1500);

      // Refresh members
      const updatedMembers = await api.get<any[]>(`/workspaces/${selectedWs.id}/members`);
      setMembers(updatedMembers.data);
    } catch (err) {
      setAddStatus(`Error: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Workspaces & Keys</h1>
          <p className="text-sm text-slate-600">
            Isolated cryptographic domains with distributed search keys &bull; RSA-OAEP envelope distribution
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center space-x-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Workspace Creation Form */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 mb-3">
          Create New Workspace
        </h3>
        <form onSubmit={handleCreateWorkspace} className="flex gap-4">
          <input
            type="text"
            required
            value={newWsName}
            onChange={(e) => setNewWsName(e.target.value)}
            placeholder="Workspace Name (e.g. Applied Cryptography Research Group)..."
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isCreating}
            className="inline-flex items-center space-x-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span>Generate Workspace & Search Key</span>
          </button>
        </form>
      </div>

      {/* Workspaces & Members View */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Workspace List */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-2 mb-2">
            Your Workspaces ({workspaces.length})
          </h3>

          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => setSelectedWs(ws)}
              className={`w-full text-left p-3 rounded-lg border text-sm transition flex items-center justify-between ${
                selectedWs?.id === ws.id
                  ? 'border-blue-500 bg-blue-50 text-blue-900 font-semibold'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <FolderLock className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <span className="truncate">WS: {ws.id.substring(0, 8)}...</span>
              </div>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                {ws.role || 'Member'}
              </span>
            </button>
          ))}
        </div>

        {/* Member Management for Selected Workspace */}
        <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Workspace Members ({members.length})
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                ID: {selectedWs?.id} &bull; Key Version: {selectedWs?.keyVersion || 1}
              </p>
            </div>

            {selectedWs?.role === 'OWNER' && (
              <button
                onClick={() => setIsAddingMember(true)}
                className="inline-flex items-center space-x-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-purple-700 transition"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Distribute Search Key</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {members.map((m) => (
              <div key={m.id} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium text-slate-900">{m.user?.email}</div>
                  <div className="text-xs text-slate-400 font-mono">
                    Public Key: {m.user?.publicKeySpki?.substring(0, 24)}...
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {m.role}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      {isAddingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Add Workspace Member</h3>
            <p className="text-xs text-slate-500 mb-4">
              Unwraps the 32-byte workspace search key in your browser and re-encrypts it with the recipient&apos;s public RSA-OAEP key.
            </p>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600">
                  User Email Address
                </label>
                <input
                  type="email"
                  required
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="bob@ciphershare.io"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              {addStatus && (
                <div className="text-xs font-medium text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200">
                  {addStatus}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingMember(false);
                    setAddStatus(null);
                  }}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-purple-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-purple-700"
                >
                  Distribute Search Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
