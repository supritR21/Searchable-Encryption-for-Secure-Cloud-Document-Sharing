import { z } from 'zod';
import { CRYPTO_CONSTANTS } from '../constants/index.js';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  publicKeySpki: z.string().min(1, 'Public key is required'),
  encryptedPrivateKey: z.string().min(1, 'Encrypted private key is required'),
  privateKeySalt: z.string().min(1, 'Salt is required'),
  privateKeyNonce: z.string().min(1, 'Nonce is required'),
  privateKeyKdfParams: z.object({
    timeCost: z.number().int().min(1),
    memoryCost: z.number().int().min(1024),
    parallelism: z.number().int().min(1),
    hashLength: z.number().int().min(16),
  }),
  publicKeyAlgorithm: z.string().default('RSA-OAEP-3072'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const createWorkspaceSchema = z.object({
  encryptedName: z.string().min(1, 'Encrypted workspace name is required'),
  nameNonce: z.string().min(1, 'Name nonce is required'),
  wrappedSearchKey: z.string().min(1, 'Wrapped search key for owner is required'),
  keyVersion: z.number().int().default(CRYPTO_CONSTANTS.VERSIONS.KEY_VERSION),
});

export const addWorkspaceMemberSchema = z.object({
  userId: z.string().uuid('Invalid user UUID'),
  wrappedSearchKey: z.string().min(1, 'Wrapped search key is required'),
  keyVersion: z.number().int().default(CRYPTO_CONSTANTS.VERSIONS.KEY_VERSION),
});

export const uploadDocumentSchema = z.object({
  documentId: z.string().uuid().optional(),
  workspaceId: z.string().uuid('Invalid workspace UUID'),
  encryptedMetadata: z.string().min(1, 'Encrypted metadata is required'),
  fileNonce: z.string().min(1, 'File nonce is required'),
  metadataNonce: z.string().min(1, 'Metadata nonce is required'),
  wrappedDek: z.string().min(1, 'Wrapped DEK is required'),
  cryptoVersion: z.number().int().default(CRYPTO_CONSTANTS.VERSIONS.CRYPTO_VERSION),
  keyVersion: z.number().int().default(CRYPTO_CONSTANTS.VERSIONS.KEY_VERSION),
  searchTokens: z.array(z.string().min(1)).max(CRYPTO_CONSTANTS.LIMITS.MAX_TERMS_PER_DOCUMENT),
});

export const searchSchema = z.object({
  tokens: z.array(z.string().min(1)).min(1, 'At least one search token required').max(50),
  mode: z.enum(['AND', 'SINGLE']).default('AND'),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().nullable().optional(),
});

export const shareDocumentSchema = z.object({
  recipientUserId: z.string().uuid('Invalid recipient user UUID'),
  encryptedDek: z.string().min(1, 'Encrypted DEK is required'),
  permission: z.enum(['READ', 'OWNER']).default('READ'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type AddWorkspaceMemberInput = z.infer<typeof addWorkspaceMemberSchema>;
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
export type ShareDocumentInput = z.infer<typeof shareDocumentSchema>;
