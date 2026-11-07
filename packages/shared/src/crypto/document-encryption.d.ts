import { DocumentMetadata } from '../types/index.js';
/**
 * Generate a versioned Additional Authenticated Data (AAD) byte array bound to workspace and document IDs.
 * Prevents cut-and-paste attacks between different workspaces or documents.
 */
export declare function buildDocumentAAD(workspaceId: string, documentId: string, version?: number): Uint8Array;
/**
 * Encrypt document bytes using AES-256-GCM with a fresh random 12-byte nonce and bound AAD.
 * Web Crypto API appends the 16-byte authentication tag to the ciphertext buffer.
 */
export declare function encryptDocument(fileBytes: Uint8Array, dek: Uint8Array, workspaceId: string, documentId: string): Promise<{
    ciphertext: Uint8Array;
    nonce: Uint8Array;
}>;
/**
 * Decrypt document bytes using AES-256-GCM, verifying authentication tag and AAD.
 * Throws OperationError if ciphertext was modified or keys/AAD do not match.
 */
export declare function decryptDocument(ciphertext: Uint8Array, nonce: Uint8Array, dek: Uint8Array, workspaceId: string, documentId: string): Promise<Uint8Array>;
/**
 * Encrypt document metadata (filename, mime type, size, timestamps) using AES-256-GCM with a separate nonce.
 */
export declare function encryptMetadata(metadata: DocumentMetadata, dek: Uint8Array): Promise<{
    encryptedMetadata: Uint8Array;
    nonce: Uint8Array;
}>;
/**
 * Decrypt document metadata and return parsed DocumentMetadata
 */
export declare function decryptMetadata(encryptedMetadata: Uint8Array, nonce: Uint8Array, dek: Uint8Array): Promise<DocumentMetadata>;
