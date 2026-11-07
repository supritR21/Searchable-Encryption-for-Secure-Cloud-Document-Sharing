import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import { createMockPrisma } from './mock-prisma.js';

const { mockPrisma } = createMockPrisma();

// Mock prisma before importing app
vi.mock('../src/config/prisma.js', () => ({
  prisma: mockPrisma,
}));

// Import app after mocking
const { app } = await import('../src/app.js');

describe('CipherShare Express API & Authorization Integration Tests', () => {
  let aliceToken = '';
  let aliceId = '';
  let bobToken = '';
  let bobId = '';
  let workspaceId = '';
  let documentId = '';

  const sampleSpki = Buffer.from('mock-alice-spki-bytes-3072').toString('base64');
  const sampleEncryptedPriv = Buffer.from('mock-encrypted-privkey').toString('base64');
  const sampleSalt = Buffer.from('mock-16-byte-salt').toString('base64');
  const sampleNonce = Buffer.from('mock-12-byte-n').toString('base64');

  it('POST /api/v1/auth/register: registers Alice with public key and encrypted private key package', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'alice@ciphershare.io',
        password: 'Password123!',
        publicKeySpki: sampleSpki,
        encryptedPrivateKey: sampleEncryptedPriv,
        privateKeySalt: sampleSalt,
        privateKeyNonce: sampleNonce,
        privateKeyKdfParams: {
          timeCost: 1,
          memoryCost: 4096,
          parallelism: 1,
          hashLength: 32,
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe('alice@ciphershare.io');

    aliceToken = res.body.data.token;
    aliceId = res.body.data.user.id;
  });

  it('POST /api/v1/auth/register: registers Bob', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'bob@ciphershare.io',
        password: 'Password456!',
        publicKeySpki: Buffer.from('mock-bob-spki-bytes-3072').toString('base64'),
        encryptedPrivateKey: sampleEncryptedPriv,
        privateKeySalt: sampleSalt,
        privateKeyNonce: sampleNonce,
        privateKeyKdfParams: {
          timeCost: 1,
          memoryCost: 4096,
          parallelism: 1,
          hashLength: 32,
        },
      });

    expect(res.status).toBe(201);
    bobToken = res.body.data.token;
    bobId = res.body.data.user.id;
  });

  it('POST /api/v1/auth/login: fails with wrong password (HTTP 401)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'alice@ciphershare.io',
        password: 'WrongPassword!',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/auth/login: succeeds with correct password and returns encrypted private key package', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'alice@ciphershare.io',
        password: 'Password123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.encryptedPrivateKey).toBe(sampleEncryptedPriv);
    expect(res.body.data.user.privateKeySalt).toBe(sampleSalt);
  });

  it('GET /api/v1/auth/me: retrieves authenticated profile', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('alice@ciphershare.io');
  });

  it('POST /api/v1/workspaces: Alice creates a workspace with owner-wrapped search key', async () => {
    const res = await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        encryptedName: Buffer.from('Encrypted Workspace Title').toString('base64'),
        nameNonce: Buffer.from('12-byte-nonce').toString('base64'),
        wrappedSearchKey: Buffer.from('wrapped-search-key-for-alice').toString('base64'),
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.role).toBe('OWNER');

    workspaceId = res.body.data.id;
  });

  it('POST /api/v1/workspaces/:id/members: Alice securely adds Bob to workspace with wrapped search key', async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        userId: bobId,
        wrappedSearchKey: Buffer.from('wrapped-search-key-for-bob').toString('base64'),
      });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('MEMBER');
  });

  it('POST /api/v1/workspaces/:workspaceId/documents: Alice uploads encrypted document with search tokens', async () => {
    const token1 = 'mock-base64url-token-cryptography';
    const token2 = 'mock-base64url-token-research';

    const res = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/documents`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .field('encryptedMetadata', Buffer.from('{"originalName":"research.pdf"}').toString('base64'))
      .field('fileNonce', Buffer.from('12-byte-nonce-f').toString('base64'))
      .field('metadataNonce', Buffer.from('12-byte-nonce-m').toString('base64'))
      .field('wrappedDek', Buffer.from('wrapped-dek-for-alice').toString('base64'))
      .field('searchTokens', JSON.stringify([token1, token2]))
      .attach('file', Buffer.from('ENCRYPTED_AES_GCM_CIPHERTEXT_BYTES_NO_PLAINTEXT'), 'research.pdf');

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    documentId = res.body.data.id;
  });

  it('POST /api/v1/workspaces/:id/search: executes AND search over opaque tokens', async () => {
    const token1 = 'mock-base64url-token-cryptography';
    const token2 = 'mock-base64url-token-research';

    // Multi-token AND search matching both
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/search`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        tokens: [token1, token2],
        mode: 'AND',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.documents.length).toBe(1);
    expect(res.body.data.documents[0].id).toBe(documentId);
    expect(res.body.data.searchDurationMs).toBeDefined();
  });

  it('POST /api/v1/workspaces/:id/search: returns 0 matches when token is absent', async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/search`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        tokens: ['mock-base64url-token-nonexistent'],
        mode: 'AND',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.documents.length).toBe(0);
  });

  it('GET /api/v1/documents/:id: Bob cannot access document before Alice shares it (HTTP 404/403)', async () => {
    const res = await request(app)
      .get(`/api/v1/documents/${documentId}`)
      .set('Authorization', `Bearer ${bobToken}`);

    expect(res.status).toBe(404);
  });

  it('POST /api/v1/documents/:id/share: Alice shares document with Bob (wrapped DEK)', async () => {
    const res = await request(app)
      .post(`/api/v1/documents/${documentId}/share`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        recipientUserId: bobId,
        encryptedDek: Buffer.from('wrapped-dek-for-bob-rsa-oaep').toString('base64'),
        permission: 'READ',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.permission).toBe('READ');
  });

  it('GET /api/v1/documents/:id: Bob can now retrieve document metadata and his wrapped DEK', async () => {
    const res = await request(app)
      .get(`/api/v1/documents/${documentId}`)
      .set('Authorization', `Bearer ${bobToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(documentId);
    expect(res.body.data.wrappedDek).toBe(
      Buffer.from('wrapped-dek-for-bob-rsa-oaep').toString('base64')
    );
  });

  it('GET /api/v1/documents/:id/content: Bob can retrieve encrypted file bytes', async () => {
    const res = await request(app)
      .get(`/api/v1/documents/${documentId}/content`)
      .set('Authorization', `Bearer ${bobToken}`);

    expect(res.status).toBe(200);
    expect(res.body.toString()).toBe('ENCRYPTED_AES_GCM_CIPHERTEXT_BYTES_NO_PLAINTEXT');
  });

  it('DELETE /api/v1/documents/:id/access/:userId: Alice revokes Bob access', async () => {
    const res = await request(app)
      .delete(`/api/v1/documents/${documentId}/access/${bobId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/v1/documents/:id: Bob is blocked after revocation', async () => {
    const res = await request(app)
      .get(`/api/v1/documents/${documentId}`)
      .set('Authorization', `Bearer ${bobToken}`);

    expect(res.status).toBe(404);
  });
});
