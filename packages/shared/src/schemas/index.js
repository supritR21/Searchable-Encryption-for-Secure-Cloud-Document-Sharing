"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shareDocumentSchema = exports.searchSchema = exports.uploadDocumentSchema = exports.addWorkspaceMemberSchema = exports.createWorkspaceSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
const index_js_1 = require("../constants/index.js");
exports.registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address').max(255),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters').max(128),
    publicKeySpki: zod_1.z.string().min(1, 'Public key is required'),
    encryptedPrivateKey: zod_1.z.string().min(1, 'Encrypted private key is required'),
    privateKeySalt: zod_1.z.string().min(1, 'Salt is required'),
    privateKeyNonce: zod_1.z.string().min(1, 'Nonce is required'),
    privateKeyKdfParams: zod_1.z.object({
        timeCost: zod_1.z.number().int().min(1),
        memoryCost: zod_1.z.number().int().min(1024),
        parallelism: zod_1.z.number().int().min(1),
        hashLength: zod_1.z.number().int().min(16),
    }),
    publicKeyAlgorithm: zod_1.z.string().default('RSA-OAEP-3072'),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.createWorkspaceSchema = zod_1.z.object({
    encryptedName: zod_1.z.string().min(1, 'Encrypted workspace name is required'),
    nameNonce: zod_1.z.string().min(1, 'Name nonce is required'),
    wrappedSearchKey: zod_1.z.string().min(1, 'Wrapped search key for owner is required'),
    keyVersion: zod_1.z.number().int().default(index_js_1.CRYPTO_CONSTANTS.VERSIONS.KEY_VERSION),
});
exports.addWorkspaceMemberSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid('Invalid user UUID'),
    wrappedSearchKey: zod_1.z.string().min(1, 'Wrapped search key is required'),
    keyVersion: zod_1.z.number().int().default(index_js_1.CRYPTO_CONSTANTS.VERSIONS.KEY_VERSION),
});
exports.uploadDocumentSchema = zod_1.z.object({
    documentId: zod_1.z.string().uuid().optional(),
    workspaceId: zod_1.z.string().uuid('Invalid workspace UUID'),
    encryptedMetadata: zod_1.z.string().min(1, 'Encrypted metadata is required'),
    fileNonce: zod_1.z.string().min(1, 'File nonce is required'),
    metadataNonce: zod_1.z.string().min(1, 'Metadata nonce is required'),
    wrappedDek: zod_1.z.string().min(1, 'Wrapped DEK is required'),
    cryptoVersion: zod_1.z.number().int().default(index_js_1.CRYPTO_CONSTANTS.VERSIONS.CRYPTO_VERSION),
    keyVersion: zod_1.z.number().int().default(index_js_1.CRYPTO_CONSTANTS.VERSIONS.KEY_VERSION),
    searchTokens: zod_1.z.array(zod_1.z.string().min(1)).max(index_js_1.CRYPTO_CONSTANTS.LIMITS.MAX_TERMS_PER_DOCUMENT),
});
exports.searchSchema = zod_1.z.object({
    tokens: zod_1.z.array(zod_1.z.string().min(1)).min(1, 'At least one search token required').max(50),
    mode: zod_1.z.enum(['AND', 'SINGLE']).default('AND'),
    limit: zod_1.z.number().int().min(1).max(100).default(20),
    cursor: zod_1.z.string().uuid().nullable().optional(),
});
exports.shareDocumentSchema = zod_1.z.object({
    recipientUserId: zod_1.z.string().uuid('Invalid recipient user UUID'),
    encryptedDek: zod_1.z.string().min(1, 'Encrypted DEK is required'),
    permission: zod_1.z.enum(['READ', 'OWNER']).default('READ'),
});
