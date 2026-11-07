/**
 * Common, versioned normalization function for indexing and searching.
 * 1. Normalize text using Unicode NFC.
 * 2. Convert to lowercase.
 * 3. Extract Unicode letter and number sequences.
 * 4. Remove duplicate terms.
 * 5. Ignore empty terms.
 */
export declare function normalizeText(text: string): string[];
/**
 * Compute the 32-byte HMAC-SHA-256 search token for a normalized keyword:
 * T = HMAC-SHA-256(workspaceSearchKey, "ciphershare|" + workspaceId + "|" + keyword)
 */
export declare function generateSearchToken(workspaceSearchKey: Uint8Array, workspaceId: string, keyword: string): Promise<Uint8Array>;
/**
 * Extract searchable keywords from document text, compute HMAC search tokens,
 * and return Base64URL-encoded tokens for database storage.
 */
export declare function generateDocumentTokens(workspaceSearchKey: Uint8Array, workspaceId: string, text: string): Promise<string[]>;
/**
 * Generate Base64URL-encoded search tokens for query keywords
 */
export declare function generateQueryTokens(workspaceSearchKey: Uint8Array, workspaceId: string, query: string): Promise<string[]>;
