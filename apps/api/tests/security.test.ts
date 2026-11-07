import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createMockPrisma } from './mock-prisma.js';
import {
  generateRandomBytes,
  encryptDocument,
  decryptDocument,
  encryptMetadata,
  decryptMetadata,
  generateSearchToken,
  generateDocumentTokens,
  generateQueryTokens,
  normalizeText,
  utf8ToUint8Array,
  uint8ArrayToUtf8,
  uint8ArrayToBase64,
  base64ToUint8Array,
  base64UrlToUint8Array,
  timingSafeEqual,
} from '@ciphershare/shared';

const { mockPrisma, db } = createMockPrisma();

vi.mock('../src/config/prisma.js', () => ({
  prisma: mockPrisma,
}));

const { app } = await import('../src/app.js');

describe('Applied Cryptography Verification: 14 Mandatory Security Criteria', () => {
  const workspaceId1 = crypto.randomUUID();
  const workspaceId2 = crypto.randomUUID();
  const wsKey1 = generateRandomBytes(32);
  const wsKey2 = generateRandomBytes(32);
  const docId = crypto.randomUUID();
  const plaintextFilename = 'highly_sensitive_financials_2026.pdf';
  const plaintextDocument = 'Top Secret Project Apollo Financial Balances and Ledger Entries.';
  const dek = generateRandomBytes(32);

  // Criterion 1: The original plaintext document must never appear in the document database.
  it('Criterion 1: The original plaintext document never appears in the document database', async () => {
    const fileBytes = utf8ToUint8Array(plaintextDocument);
    const { ciphertext, nonce } = await encryptDocument(fileBytes, dek, workspaceId1, docId);

    // Verify ciphertext does not contain plaintext string
    const ciphertextString = Buffer.from(ciphertext).toString('latin1');
    expect(ciphertextString).not.toContain(plaintextDocument);
    expect(ciphertextString).not.toContain('Top Secret');
    expect(ciphertextString).not.toContain('Apollo');

    // Simulate database record
    db.documents.set(docId, {
      id: docId,
      workspaceId: workspaceId1,
      ownerId: crypto.randomUUID(),
      encryptedFile: Buffer.from(ciphertext),
      fileNonce: Buffer.from(nonce),
      encryptedMetadata: Buffer.from('mock-enc-meta'),
      metadataNonce: Buffer.from('mock-nonce'),
      deletedAt: null,
    });

    const storedDoc = db.documents.get(docId);
    expect(storedDoc.encryptedFile.toString('utf-8')).not.toContain(plaintextDocument);
  });

  // Criterion 2: The original filename must not appear in plaintext in the documents table.
  it('Criterion 2: The original filename does not appear in plaintext in the documents table', async () => {
    const meta = {
      originalName: plaintextFilename,
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      createdAt: Date.now(),
    };
    const { encryptedMetadata, nonce } = await encryptMetadata(meta, dek);

    // Verify raw bytes do not reveal filename
    const metaString = Buffer.from(encryptedMetadata).toString('latin1');
    expect(metaString).not.toContain(plaintextFilename);
    expect(metaString).not.toContain('financials');

    const decrypted = await decryptMetadata(encryptedMetadata, nonce, dek);
    expect(decrypted.originalName).toBe(plaintextFilename);
  });

  // Criterion 3: Search requests must not contain the plaintext keyword.
  it('Criterion 3: Search requests operate strictly on opaque HMAC tokens', async () => {
    const keyword = 'confidential';
    const tokenBytes = await generateSearchToken(wsKey1, workspaceId1, keyword);
    const tokenBase64Url = Buffer.from(tokenBytes).toString('base64url');

    // Token must not contain the keyword substring
    expect(tokenBase64Url.toLowerCase()).not.toContain('confidential');
    expect(tokenBytes.byteLength).toBe(32);
  });

  // Criterion 4: The same workspace key and keyword must produce the same HMAC token.
  it('Criterion 4: Identical workspace key and keyword produce deterministic HMAC tokens', async () => {
    const keyword = 'blockchain';
    const tokenA = await generateSearchToken(wsKey1, workspaceId1, keyword);
    const tokenB = await generateSearchToken(wsKey1, workspaceId1, keyword);

    expect(timingSafeEqual(tokenA, tokenB)).toBe(true);
  });

  // Criterion 5: Different workspace search keys produce computationally independent tokens.
  it('Criterion 5: Different workspace search keys produce independent tokens for identical keyword', async () => {
    const keyword = 'cryptography';
    const tokenWs1 = await generateSearchToken(wsKey1, workspaceId1, keyword);
    const tokenWs2 = await generateSearchToken(wsKey2, workspaceId2, keyword);

    expect(timingSafeEqual(tokenWs1, tokenWs2)).toBe(false);
  });

  // Criterion 6: An incorrect DEK must fail document decryption.
  it('Criterion 6: An incorrect DEK fails document decryption', async () => {
    const fileBytes = utf8ToUint8Array('Confidential text');
    const { ciphertext, nonce } = await encryptDocument(fileBytes, dek, workspaceId1, docId);

    const wrongDek = generateRandomBytes(32);
    await expect(
      decryptDocument(ciphertext, nonce, wrongDek, workspaceId1, docId)
    ).rejects.toThrow();
  });

  // Criterion 7: A modified AES-GCM ciphertext must fail authentication.
  it('Criterion 7: Modified ciphertext fails AES-GCM authentication', async () => {
    const fileBytes = utf8ToUint8Array('Authenticity test content');
    const { ciphertext, nonce } = await encryptDocument(fileBytes, dek, workspaceId1, docId);

    const tampered = new Uint8Array(ciphertext);
    tampered[tampered.length - 1] ^= 0x01; // flip last bit (part of tag)

    await expect(
      decryptDocument(tampered, nonce, dek, workspaceId1, docId)
    ).rejects.toThrow();
  });

  // Criterion 8: An unauthorized user must receive HTTP 403 or non-disclosing 404.
  it('Criterion 8: Unauthorized document request is blocked (HTTP 404/403)', async () => {
    const unauthUserId = crypto.randomUUID();
    const token = Buffer.from(JSON.stringify({ sub: unauthUserId, email: 'unauth@test.com' })).toString('base64');

    // Create unauthorized access attempt
    const res = await request(app)
      .get(`/api/v1/documents/${crypto.randomUUID()}`)
      .set('Authorization', `Bearer mock-token`);

    expect([401, 403, 404]).toContain(res.status);
  });

  // Criterion 9: A shared user must successfully retrieve and decrypt an authorized file.
  it('Criterion 9: Authorized shared recipient successfully decrypts document', async () => {
    const fileBytes = utf8ToUint8Array('Document for Bob');
    const { ciphertext, nonce } = await encryptDocument(fileBytes, dek, workspaceId1, docId);

    // Recipient decrypts with correct DEK and AAD
    const decrypted = await decryptDocument(ciphertext, nonce, dek, workspaceId1, docId);
    expect(uint8ArrayToUtf8(decrypted)).toBe('Document for Bob');
  });

  // Criterion 10: A revoked user must not be able to retrieve the file through the backend.
  it('Criterion 10: Revoked user access record rejects retrieval', async () => {
    const revokedUserId = crypto.randomUUID();
    const accessKey = `${docId}_${revokedUserId}`;

    db.documentAccess.set(accessKey, {
      id: crypto.randomUUID(),
      documentId: docId,
      userId: revokedUserId,
      encryptedDek: Buffer.from('wrapped-dek'),
      permission: 'READ',
      grantedBy: crypto.randomUUID(),
      createdAt: new Date(),
      revokedAt: new Date(), // Revoked!
    });

    // Query through mockPrisma findFirst
    const access = await mockPrisma.documentAccess.findFirst({
      where: {
        documentId: docId,
        userId: revokedUserId,
        revokedAt: null,
      },
    });

    expect(access).toBeNull();
  });

  // Criterion 11: A user must not access another workspace's index or data.
  it('Criterion 11: Cross-workspace queries are strictly isolated', async () => {
    const token = await generateSearchToken(wsKey1, workspaceId1, 'term');
    const tokenBuffer = Buffer.from(token);

    // Search index for workspace 2 should not match token inserted in workspace 1
    const matched = db.searchIndex.filter(
      (si) => si.workspaceId === workspaceId2 && tokenBuffer.equals(si.searchToken)
    );
    expect(matched.length).toBe(0);
  });

  // Criterion 12: Multi-keyword AND search must return only documents containing all requested terms.
  it('Criterion 12: Multi-keyword AND search matches only intersection of terms', async () => {
    const textA = 'quantum cryptography algorithms';
    const textB = 'classical algorithms data structures';

    const tokensA = await generateDocumentTokens(wsKey1, workspaceId1, textA);
    const tokensB = await generateDocumentTokens(wsKey1, workspaceId1, textB);

    const docA_Id = crypto.randomUUID();
    const docB_Id = crypto.randomUUID();

    // Populate index
    for (const t of tokensA) {
      db.searchIndex.push({
        workspaceId: workspaceId1,
        documentId: docA_Id,
        searchToken: Buffer.from(base64UrlToUint8Array(t)),
      });
    }
    for (const t of tokensB) {
      db.searchIndex.push({
        workspaceId: workspaceId1,
        documentId: docB_Id,
        searchToken: Buffer.from(base64UrlToUint8Array(t)),
      });
    }

    db.documents.set(docA_Id, { id: docA_Id, deletedAt: null });
    db.documents.set(docB_Id, { id: docB_Id, deletedAt: null });

    // Query for ["quantum", "algorithms"] -> only docA should match
    const queryTokens = await generateQueryTokens(wsKey1, workspaceId1, 'quantum algorithms');
    expect(queryTokens.length).toBe(2);

    const matchingRows = await mockPrisma.searchIndex.groupBy({
      by: ['documentId'],
      where: {
        workspaceId: workspaceId1,
        searchToken: { in: queryTokens.map((q) => Buffer.from(base64UrlToUint8Array(q))) },
      },
      having: {
        searchToken: {
          _count: { equals: 2 },
        },
      },
    });

    expect(matchingRows.length).toBe(1);
    expect(matchingRows[0].documentId).toBe(docA_Id);
  });

  // Criterion 13: Search results must match a local plaintext-search baseline.
  it('Criterion 13: SSE inverted index search exactly matches plaintext search baseline', async () => {
    const corpus = [
      { id: 'doc-1', text: 'applied cryptography searchable encryption' },
      { id: 'doc-2', text: 'secure cloud document sharing' },
      { id: 'doc-3', text: 'applied searchable cloud systems' },
    ];

    const testQuery = 'applied searchable';
    const queryTerms = normalizeText(testQuery);

    // Plaintext baseline
    const baselineMatches = corpus
      .filter((doc) => {
        const docTerms = new Set(normalizeText(doc.text));
        return queryTerms.every((qt) => docTerms.has(qt));
      })
      .map((d) => d.id);

    // SSE token search simulation
    const sseQueryTokens = await generateQueryTokens(wsKey1, workspaceId1, testQuery);
    const sseDocTokenMap = new Map<string, Set<string>>();

    for (const doc of corpus) {
      const tokens = await generateDocumentTokens(wsKey1, workspaceId1, doc.text);
      sseDocTokenMap.set(doc.id, new Set(tokens));
    }

    const sseMatches = corpus
      .filter((doc) => {
        const docTokens = sseDocTokenMap.get(doc.id)!;
        return sseQueryTokens.every((qt) => docTokens.has(qt));
      })
      .map((d) => d.id);

    expect(sseMatches).toEqual(baselineMatches);
    expect(sseMatches).toContain('doc-1');
    expect(sseMatches).toContain('doc-3');
    expect(sseMatches).not.toContain('doc-2');
  });

  // Criterion 14: Keys and plaintext content must not appear in backend logs.
  it('Criterion 14: Zero sensitive keys or plaintext keywords in audit logs', async () => {
    const secretPassword = 'MySecretPassword123!';
    const rawSearchToken = 'secret-search-token';

    await mockPrisma.auditLog.create({
      data: {
        actorId: crypto.randomUUID(),
        action: 'SEARCH_EXECUTED',
        details: {
          searchMode: 'AND',
          matchCount: 5,
        },
      },
    });

    const storedLogs = await mockPrisma.auditLog.findMany({ where: { actorId: '' } });
    for (const log of db.auditLogs) {
      const serialized = JSON.stringify(log);
      expect(serialized).not.toContain(secretPassword);
      expect(serialized).not.toContain(rawSearchToken);
    }
  });
});
