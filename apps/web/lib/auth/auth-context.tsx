'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserProfile,
  generateUserKeyPair,
  exportPublicKey,
  protectPrivateKey,
  unlockPrivateKey,
  importPublicKey,
  base64ToUint8Array,
  uint8ArrayToBase64,
} from '@ciphershare/shared';
import { api } from '../api/client';

interface AuthContextType {
  user: UserProfile | null;
  privateKey: CryptoKey | null;
  publicKey: CryptoKey | null;
  workspaceSearchKeys: Map<string, Uint8Array>;
  setWorkspaceSearchKey: (workspaceId: string, key: Uint8Array) => void;
  getWorkspaceSearchKey: (workspaceId: string) => Uint8Array | undefined;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [publicKey, setPublicKey] = useState<CryptoKey | null>(null);
  const [workspaceSearchKeys] = useState<Map<string, Uint8Array>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const setWorkspaceSearchKey = (workspaceId: string, key: Uint8Array) => {
    workspaceSearchKeys.set(workspaceId, key);
  };

  const getWorkspaceSearchKey = (workspaceId: string) => {
    return workspaceSearchKeys.get(workspaceId);
  };

  useEffect(() => {
    // Check if session token exists
    const token = api.getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    // Try fetching profile
    api
      .get<UserProfile>('/auth/me')
      .then((res) => {
        setUser(res.data);
      })
      .catch(() => {
        api.setToken(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.post<{ token: string; user: UserProfile }>('/auth/login', {
        email,
        password,
      });

      api.setToken(res.data.token);
      const userProfile = res.data.user;
      setUser(userProfile);

      // Local decryption: Unlock RSA-OAEP private key in client memory
      const encryptedPriv = base64ToUint8Array(userProfile.encryptedPrivateKey);
      const salt = base64ToUint8Array(userProfile.privateKeySalt);
      const nonce = base64ToUint8Array(userProfile.privateKeyNonce);

      const unlockedPrivKey = await unlockPrivateKey(
        encryptedPriv,
        salt,
        nonce,
        password,
        userProfile.privateKeyKdfParams
      );

      const importedPubKey = await importPublicKey(base64ToUint8Array(userProfile.publicKeySpki));

      setPrivateKey(unlockedPrivKey);
      setPublicKey(importedPubKey);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // 1. Generate RSA-OAEP 3072-bit key pair in browser
      const keyPair = await generateUserKeyPair();

      // 2. Export public key to SPKI
      const spkiBytes = await exportPublicKey(keyPair.publicKey);

      // 3. Protect private key with Argon2id-derived AES key
      const protectedBundle = await protectPrivateKey(keyPair.privateKey, password);

      // 4. Register with backend
      const res = await api.post<{ token: string; user: UserProfile }>('/auth/register', {
        email,
        password,
        publicKeySpki: uint8ArrayToBase64(spkiBytes),
        encryptedPrivateKey: uint8ArrayToBase64(protectedBundle.encryptedPrivateKey),
        privateKeySalt: uint8ArrayToBase64(protectedBundle.salt),
        privateKeyNonce: uint8ArrayToBase64(protectedBundle.nonce),
        privateKeyKdfParams: protectedBundle.kdfParams,
      });

      api.setToken(res.data.token);
      setUser(res.data.user);
      setPrivateKey(keyPair.privateKey);
      setPublicKey(keyPair.publicKey);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    api.post('/auth/logout').catch(() => {});
    api.setToken(null);
    setUser(null);
    setPrivateKey(null);
    setPublicKey(null);
    workspaceSearchKeys.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        privateKey,
        publicKey,
        workspaceSearchKeys,
        setWorkspaceSearchKey,
        getWorkspaceSearchKey,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
