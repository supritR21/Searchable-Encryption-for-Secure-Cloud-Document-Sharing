import { CRYPTO_CONSTANTS } from '../constants/index.js';
import { DocumentMetadata } from '../types/index.js';
import { utf8ToUint8Array, uint8ArrayToUtf8 } from '../utils/encoding.js';
import { generateRandomBytes } from './key-management.js';

const subtle = globalThis.crypto.subtle;

/**
 * Generate a versioned Additional Authenticated Data (AAD) byte array bound to workspace and document IDs.
 * Prevents cut-and-paste attacks between different workspaces or documents.
 */
export function buildDocumentAAD(workspaceId: string, documentId: string, version = 1): Uint8Array {
  const aadString = `${CRYPTO_CONSTANTS.PREFIXES.AAD}v${version}|${workspaceId}|${documentId}`;
  return utf8ToUint8Array(aadString);
}

/**
 * Import a 32-byte raw DEK as an AES-GCM CryptoKey
 */
async function importAesKey(rawKey: Uint8Array): Promise<CryptoKey> {
  if (rawKey.byteLength !== CRYPTO_CONSTANTS.AES_GCM.KEY_LENGTH_BYTES) {
    throw new Error(`Invalid DEK length: expected ${CRYPTO_CONSTANTS.AES_GCM.KEY_LENGTH_BYTES} bytes, got ${rawKey.byteLength}`);
  }
  return await subtle.importKey(
    'raw',
    rawKey as unknown as BufferSource,
    { name: CRYPTO_CONSTANTS.AES_GCM.ALGORITHM },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt document bytes using AES-256-GCM with a fresh random 12-byte nonce and bound AAD.
 * Web Crypto API appends the 16-byte authentication tag to the ciphertext buffer.
 */
export async function encryptDocument(
  fileBytes: Uint8Array,
  dek: Uint8Array,
  workspaceId: string,
  documentId: string
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  if (fileBytes.byteLength > CRYPTO_CONSTANTS.LIMITS.MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(`File size exceeds maximum allowed upload limit of ${CRYPTO_CONSTANTS.LIMITS.MAX_UPLOAD_SIZE_BYTES} bytes`);
  }

  const nonce = generateRandomBytes(CRYPTO_CONSTANTS.AES_GCM.NONCE_LENGTH_BYTES);
  const aad = buildDocumentAAD(workspaceId, documentId);
  const key = await importAesKey(dek);

  const encryptedBuffer = await subtle.encrypt(
    {
      name: CRYPTO_CONSTANTS.AES_GCM.ALGORITHM,
      iv: nonce as unknown as BufferSource,
      additionalData: aad as unknown as BufferSource,
      tagLength: CRYPTO_CONSTANTS.AES_GCM.TAG_LENGTH_BITS,
    },
    key,
    fileBytes as unknown as BufferSource
  );

  return {
    ciphertext: new Uint8Array(encryptedBuffer),
    nonce,
  };
}

/**
 * Decrypt document bytes using AES-256-GCM, verifying authentication tag and AAD.
 * Throws OperationError if ciphertext was modified or keys/AAD do not match.
 */
export async function decryptDocument(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  dek: Uint8Array,
  workspaceId: string,
  documentId: string
): Promise<Uint8Array> {
  const aad = buildDocumentAAD(workspaceId, documentId);
  const key = await importAesKey(dek);

  const decryptedBuffer = await subtle.decrypt(
    {
      name: CRYPTO_CONSTANTS.AES_GCM.ALGORITHM,
      iv: nonce as unknown as BufferSource,
      additionalData: aad as unknown as BufferSource,
      tagLength: CRYPTO_CONSTANTS.AES_GCM.TAG_LENGTH_BITS,
    },
    key,
    ciphertext as unknown as BufferSource
  );

  return new Uint8Array(decryptedBuffer);
}

/**
 * Encrypt document metadata (filename, mime type, size, timestamps) using AES-256-GCM with a separate nonce.
 */
export async function encryptMetadata(
  metadata: DocumentMetadata,
  dek: Uint8Array
): Promise<{ encryptedMetadata: Uint8Array; nonce: Uint8Array }> {
  const nonce = generateRandomBytes(CRYPTO_CONSTANTS.AES_GCM.NONCE_LENGTH_BYTES);
  const jsonStr = JSON.stringify(metadata);
  const dataBytes = utf8ToUint8Array(jsonStr);
  const key = await importAesKey(dek);

  const encryptedBuffer = await subtle.encrypt(
    {
      name: CRYPTO_CONSTANTS.AES_GCM.ALGORITHM,
      iv: nonce as unknown as BufferSource,
      tagLength: CRYPTO_CONSTANTS.AES_GCM.TAG_LENGTH_BITS,
    },
    key,
    dataBytes as unknown as BufferSource
  );

  return {
    encryptedMetadata: new Uint8Array(encryptedBuffer),
    nonce,
  };
}

/**
 * Decrypt document metadata and return parsed DocumentMetadata
 */
export async function decryptMetadata(
  encryptedMetadata: Uint8Array,
  nonce: Uint8Array,
  dek: Uint8Array
): Promise<DocumentMetadata> {
  const key = await importAesKey(dek);

  const decryptedBuffer = await subtle.decrypt(
    {
      name: CRYPTO_CONSTANTS.AES_GCM.ALGORITHM,
      iv: nonce as unknown as BufferSource,
      tagLength: CRYPTO_CONSTANTS.AES_GCM.TAG_LENGTH_BITS,
    },
    key,
    encryptedMetadata as unknown as BufferSource
  );

  const jsonStr = uint8ArrayToUtf8(new Uint8Array(decryptedBuffer));
  return JSON.parse(jsonStr) as DocumentMetadata;
}
