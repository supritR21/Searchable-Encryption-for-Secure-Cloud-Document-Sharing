import { describe, it, expect } from 'vitest';
import {
  generateUserKeyPair,
  exportPublicKey,
  exportPrivateKey,
  importPublicKey,
  importPrivateKey,
  protectPrivateKey,
  unlockPrivateKey,
  generateRandomBytes,
  wrapKeyForRecipient,
  unwrapKeyForUser,
} from '../src/crypto/key-management.js';
import {
  encryptDocument,
  decryptDocument,
  encryptMetadata,
  decryptMetadata,
} from '../src/crypto/document-encryption.js';
import {
  normalizeText,
  generateSearchToken,
  generateDocumentTokens,
  generateQueryTokens,
} from '../src/crypto/searchable-encryption.js';
import {
  utf8ToUint8Array,
  uint8ArrayToUtf8,
  uint8ArrayToBase64Url,
} from '../src/utils/encoding.js';

describe('Key Management & Identity Cryptography', () => {
  it('generates 3072-bit RSA-OAEP key pairs and exports/imports SPKI & PKCS8', async () => {
    const keyPair = await generateUserKeyPair();
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.privateKey).toBeDefined();

    const spkiBytes = await exportPublicKey(keyPair.publicKey);
    expect(spkiBytes.byteLength).toBeGreaterThan(300);

    const pkcs8Bytes = await exportPrivateKey(keyPair.privateKey);
    expect(pkcs8Bytes.byteLength).toBeGreaterThan(1000);

    const importedPub = await importPublicKey(spkiBytes);
    const importedPriv = await importPrivateKey(pkcs8Bytes);

    expect(importedPub.type).toBe('public');
    expect(importedPriv.type).toBe('private');
  });

  it('protects private key with Argon2id-derived AES-GCM and unlocks it with correct password', async () => {
    const keyPair = await generateUserKeyPair();
    const password = 'CorrectHorseBatteryStaple123!';

    // Protect with Argon2id + AES-GCM
    const protectedBundle = await protectPrivateKey(keyPair.privateKey, password, {
      timeCost: 1, // 1 iteration for fast unit tests
      memoryCost: 4096, // 4MB for fast unit tests
    });

    expect(protectedBundle.encryptedPrivateKey).toBeDefined();
    expect(protectedBundle.salt.byteLength).toBe(16);
    expect(protectedBundle.nonce.byteLength).toBe(12);

    // Unlock with correct password
    const unlockedPriv = await unlockPrivateKey(
      protectedBundle.encryptedPrivateKey,
      protectedBundle.salt,
      protectedBundle.nonce,
      password,
      protectedBundle.kdfParams
    );

    expect(unlockedPriv).toBeDefined();
    expect(unlockedPriv.type).toBe('private');

    // Test decryption failure with wrong password
    await expect(
      unlockPrivateKey(
        protectedBundle.encryptedPrivateKey,
        protectedBundle.salt,
        protectedBundle.nonce,
        'WrongPassword456!',
        protectedBundle.kdfParams
      )
    ).rejects.toThrow();
  });

  it('wraps and unwraps a symmetric key using RSA-OAEP', async () => {
    const keyPair = await generateUserKeyPair();
    const secretDek = generateRandomBytes(32);

    const wrappedDek = await wrapKeyForRecipient(keyPair.publicKey, secretDek);
    expect(wrappedDek.byteLength).toBe(384); // 3072 bits / 8 = 384 bytes

    const unwrappedDek = await unwrapKeyForUser(keyPair.privateKey, wrappedDek);
    expect(unwrappedDek).toEqual(secretDek);
  });
});

describe('Document Encryption (AES-256-GCM + AAD)', () => {
  const workspaceId = '00000000-0000-0000-0000-000000000001';
  const documentId = '00000000-0000-0000-0000-000000000002';
  const samplePlaintext = 'Confidential applied cryptography project document contents.';

  it('encrypts and decrypts document successfully with correct DEK and AAD', async () => {
    const fileBytes = utf8ToUint8Array(samplePlaintext);
    const dek = generateRandomBytes(32);

    const { ciphertext, nonce } = await encryptDocument(fileBytes, dek, workspaceId, documentId);
    expect(ciphertext.byteLength).toBe(fileBytes.byteLength + 16); // 16-byte GCM tag
    expect(nonce.byteLength).toBe(12);

    const decryptedBytes = await decryptDocument(ciphertext, nonce, dek, workspaceId, documentId);
    expect(uint8ArrayToUtf8(decryptedBytes)).toBe(samplePlaintext);
  });

  it('fails decryption if ciphertext is tampered with (authenticated encryption check)', async () => {
    const fileBytes = utf8ToUint8Array(samplePlaintext);
    const dek = generateRandomBytes(32);

    const { ciphertext, nonce } = await encryptDocument(fileBytes, dek, workspaceId, documentId);

    // Tamper with one byte of ciphertext
    const tampered = new Uint8Array(ciphertext);
    tampered[0] ^= 0xff;

    await expect(
      decryptDocument(tampered, nonce, dek, workspaceId, documentId)
    ).rejects.toThrow();
  });

  it('fails decryption if workspaceId or documentId in AAD is mismatched', async () => {
    const fileBytes = utf8ToUint8Array(samplePlaintext);
    const dek = generateRandomBytes(32);

    const { ciphertext, nonce } = await encryptDocument(fileBytes, dek, workspaceId, documentId);

    // Wrong document ID in AAD
    const differentDocId = '00000000-0000-0000-0000-000000000099';
    await expect(
      decryptDocument(ciphertext, nonce, dek, workspaceId, differentDocId)
    ).rejects.toThrow();
  });

  it('encrypts and decrypts metadata correctly', async () => {
    const dek = generateRandomBytes(32);
    const meta = {
      originalName: 'secret_research.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1048576,
      createdAt: Date.now(),
    };

    const { encryptedMetadata, nonce } = await encryptMetadata(meta, dek);
    const decrypted = await decryptMetadata(encryptedMetadata, nonce, dek);

    expect(decrypted.originalName).toBe(meta.originalName);
    expect(decrypted.mimeType).toBe(meta.mimeType);
    expect(decrypted.sizeBytes).toBe(meta.sizeBytes);
  });
});

describe('Searchable Symmetric Encryption (SSE Index & Tokens)', () => {
  const workspaceId = '00000000-0000-0000-0000-000000000001';
  const workspaceSearchKey = generateRandomBytes(32);

  it('normalizes text with NFC, lowercase, and unique alphanumeric sequences', () => {
    const raw = 'Machine Learning! Artificial Intelligence, MACHINE learning... naïve café';
    const terms = normalizeText(raw);

    expect(terms).toContain('machine');
    expect(terms).toContain('learning');
    expect(terms).toContain('artificial');
    expect(terms).toContain('intelligence');
    expect(terms).toContain('naïve');
    expect(terms).toContain('café');
    // Ensure duplicates removed
    expect(terms.filter((t) => t === 'machine').length).toBe(1);
    expect(terms.filter((t) => t === 'learning').length).toBe(1);
  });

  it('computes deterministic 32-byte HMAC search tokens for identical keyword and key', async () => {
    const token1 = await generateSearchToken(workspaceSearchKey, workspaceId, 'cryptography');
    const token2 = await generateSearchToken(workspaceSearchKey, workspaceId, 'cryptography');

    expect(token1.byteLength).toBe(32);
    expect(token2.byteLength).toBe(32);
    expect(token1).toEqual(token2);
  });

  it('produces computationally distinct tokens for different keywords or different workspace keys', async () => {
    const tokenCrypto = await generateSearchToken(workspaceSearchKey, workspaceId, 'cryptography');
    const tokenSecurity = await generateSearchToken(workspaceSearchKey, workspaceId, 'security');

    expect(tokenCrypto).not.toEqual(tokenSecurity);

    const differentWorkspaceKey = generateRandomBytes(32);
    const tokenDiffKey = await generateSearchToken(differentWorkspaceKey, workspaceId, 'cryptography');
    expect(tokenCrypto).not.toEqual(tokenDiffKey);
  });

  it('generates Base64URL-encoded tokens for document indexing and search queries', async () => {
    const docText = 'Applied Cryptography and Secure Document Sharing System';
    const docTokens = await generateDocumentTokens(workspaceSearchKey, workspaceId, docText);

    expect(docTokens.length).toBeGreaterThan(0);

    const queryTokens = await generateQueryTokens(workspaceSearchKey, workspaceId, 'cryptography document');
    expect(queryTokens.length).toBe(2);

    // Query tokens must be a subset of document tokens
    for (const qToken of queryTokens) {
      expect(docTokens).toContain(qToken);
    }
  });
});
