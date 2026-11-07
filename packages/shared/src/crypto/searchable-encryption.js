"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeText = normalizeText;
exports.generateSearchToken = generateSearchToken;
exports.generateDocumentTokens = generateDocumentTokens;
exports.generateQueryTokens = generateQueryTokens;
const index_js_1 = require("../constants/index.js");
const encoding_js_1 = require("../utils/encoding.js");
const subtle = globalThis.crypto.subtle;
/**
 * Common, versioned normalization function for indexing and searching.
 * 1. Normalize text using Unicode NFC.
 * 2. Convert to lowercase.
 * 3. Extract Unicode letter and number sequences.
 * 4. Remove duplicate terms.
 * 5. Ignore empty terms.
 */
function normalizeText(text) {
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
    const uniqueTerms = new Set();
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
async function importHmacKey(rawKey) {
    return await subtle.importKey('raw', rawKey, {
        name: index_js_1.CRYPTO_CONSTANTS.HMAC.ALGORITHM,
        hash: index_js_1.CRYPTO_CONSTANTS.HMAC.HASH,
    }, false, ['sign', 'verify']);
}
/**
 * Compute the 32-byte HMAC-SHA-256 search token for a normalized keyword:
 * T = HMAC-SHA-256(workspaceSearchKey, "ciphershare|" + workspaceId + "|" + keyword)
 */
async function generateSearchToken(workspaceSearchKey, workspaceId, keyword) {
    const hmacKey = await importHmacKey(workspaceSearchKey);
    const messageStr = `${index_js_1.CRYPTO_CONSTANTS.PREFIXES.TOKEN}${workspaceId}|${keyword}`;
    const messageBytes = (0, encoding_js_1.utf8ToUint8Array)(messageStr);
    const signatureBuffer = await subtle.sign(index_js_1.CRYPTO_CONSTANTS.HMAC.ALGORITHM, hmacKey, messageBytes);
    return new Uint8Array(signatureBuffer);
}
/**
 * Extract searchable keywords from document text, compute HMAC search tokens,
 * and return Base64URL-encoded tokens for database storage.
 */
async function generateDocumentTokens(workspaceSearchKey, workspaceId, text) {
    const terms = normalizeText(text);
    const limitedTerms = terms.slice(0, index_js_1.CRYPTO_CONSTANTS.LIMITS.MAX_TERMS_PER_DOCUMENT);
    const tokenPromises = limitedTerms.map(async (keyword) => {
        const rawToken = await generateSearchToken(workspaceSearchKey, workspaceId, keyword);
        return (0, encoding_js_1.uint8ArrayToBase64Url)(rawToken);
    });
    return await Promise.all(tokenPromises);
}
/**
 * Generate Base64URL-encoded search tokens for query keywords
 */
async function generateQueryTokens(workspaceSearchKey, workspaceId, query) {
    const terms = normalizeText(query);
    const tokenPromises = terms.map(async (keyword) => {
        const rawToken = await generateSearchToken(workspaceSearchKey, workspaceId, keyword);
        return (0, encoding_js_1.uint8ArrayToBase64Url)(rawToken);
    });
    return await Promise.all(tokenPromises);
}
