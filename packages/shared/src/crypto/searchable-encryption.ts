import { CRYPTO_CONSTANTS } from '../constants/index.js';
import { utf8ToUint8Array, uint8ArrayToBase64Url } from '../utils/encoding.js';

const subtle = globalThis.crypto.subtle;

/**
 * Common, versioned normalization function for indexing and searching.
 * 1. Normalize text using Unicode NFC.
 * 2. Convert to lowercase.
 * 3. Extract Unicode letter and number sequences.
 * 4. Remove duplicate terms.
 * 5. Ignore empty terms.
 */
export function normalizeText(text: string): string[] {
  if (!text) {
    return [];
  }

  // 1. Unicode NFC & 2. Lowercase
  const normalized = text.normalize('NFC').toLowerCase();

  // 3. Extract Unicode letter and number sequences
  const matches = normalized.match(/[\p{L}\p{N}]+/gu);
  if (!matches) {
    return [];
  }

  // 4. Remove duplicate terms & 5. Filter empty terms
  const uniqueTerms = new Set<string>();
  for (const term of matches) {
    const trimmed = term.trim();
    if (trimmed.length > 0) {
      uniqueTerms.add(trimmed);
    }
  }

  return Array.from(uniqueTerms);
}

/**
 * Import a 32-byte raw workspace search key as an HMAC CryptoKey
 */
async function importHmacKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return await subtle.importKey(
    'raw',
    rawKey as unknown as BufferSource,
    {
      name: CRYPTO_CONSTANTS.HMAC.ALGORITHM,
      hash: CRYPTO_CONSTANTS.HMAC.HASH,
    },
    false,
    ['sign', 'verify']
  );
}

/**
 * Compute the 32-byte HMAC-SHA-256 search token for a normalized keyword:
 * T = HMAC-SHA-256(workspaceSearchKey, "ciphershare|" + workspaceId + "|" + keyword)
 */
export async function generateSearchToken(
  workspaceSearchKey: Uint8Array,
  workspaceId: string,
  keyword: string
): Promise<Uint8Array> {
  const hmacKey = await importHmacKey(workspaceSearchKey);
  const messageStr = `${CRYPTO_CONSTANTS.PREFIXES.TOKEN}${workspaceId}|${keyword}`;
  const messageBytes = utf8ToUint8Array(messageStr);

  const signatureBuffer = await subtle.sign(
    CRYPTO_CONSTANTS.HMAC.ALGORITHM,
    hmacKey,
    messageBytes as unknown as BufferSource
  );

  return new Uint8Array(signatureBuffer);
}

/**
 * Extract searchable keywords from document text, compute HMAC search tokens,
 * and return Base64URL-encoded tokens for database storage.
 */
export async function generateDocumentTokens(
  workspaceSearchKey: Uint8Array,
  workspaceId: string,
  text: string
): Promise<string[]> {
  const terms = normalizeText(text);
  const limitedTerms = terms.slice(0, CRYPTO_CONSTANTS.LIMITS.MAX_TERMS_PER_DOCUMENT);

  const tokenPromises = limitedTerms.map(async (keyword) => {
    const rawToken = await generateSearchToken(workspaceSearchKey, workspaceId, keyword);
    return uint8ArrayToBase64Url(rawToken);
  });

  return await Promise.all(tokenPromises);
}

/**
 * Generate Base64URL-encoded search tokens for query keywords
 */
export async function generateQueryTokens(
  workspaceSearchKey: Uint8Array,
  workspaceId: string,
  query: string
): Promise<string[]> {
  const terms = normalizeText(query);
  const tokenPromises = terms.map(async (keyword) => {
    const rawToken = await generateSearchToken(workspaceSearchKey, workspaceId, keyword);
    return uint8ArrayToBase64Url(rawToken);
  });

  return await Promise.all(tokenPromises);
}
