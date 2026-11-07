import { CRYPTO_CONSTANTS } from '../constants/index.js';
import { Argon2idParams } from '../types/index.js';
import { argon2id } from 'hash-wasm';

const subtle = globalThis.crypto.subtle;

/**
 * Generate an RSA-OAEP 3072-bit key pair for user identity and key wrapping.
 */
export async function generateUserKeyPair(): Promise<CryptoKeyPair> {
  const rsaParams: RsaHashedKeyGenParams = {
    name: CRYPTO_CONSTANTS.RSA.ALGORITHM,
    modulusLength: CRYPTO_CONSTANTS.RSA.MODULUS_LENGTH,
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]) as any,
    hash: CRYPTO_CONSTANTS.RSA.HASH,
  };

  return (await subtle.generateKey(
    rsaParams,
    true, // extractable
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  )) as CryptoKeyPair;
}

/**
 * Export public key to SPKI binary format
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<Uint8Array> {
  const spki = await subtle.exportKey('spki', publicKey);
  return new Uint8Array(spki);
}

/**
 * Export private key to PKCS8 binary format
 */
export async function exportPrivateKey(privateKey: CryptoKey): Promise<Uint8Array> {
  const pkcs8 = await subtle.exportKey('pkcs8', privateKey);
  return new Uint8Array(pkcs8);
}

/**
 * Import SPKI public key
 */
export async function importPublicKey(spkiBytes: Uint8Array): Promise<CryptoKey> {
  return await subtle.importKey(
    'spki',
    spkiBytes as unknown as BufferSource,
    {
      name: CRYPTO_CONSTANTS.RSA.ALGORITHM,
      hash: CRYPTO_CONSTANTS.RSA.HASH,
    },
    true,
    ['encrypt', 'wrapKey']
  );
}

/**
 * Import PKCS8 private key
 */
export async function importPrivateKey(pkcs8Bytes: Uint8Array): Promise<CryptoKey> {
  return await subtle.importKey(
    'pkcs8',
    pkcs8Bytes as unknown as BufferSource,
    {
      name: CRYPTO_CONSTANTS.RSA.ALGORITHM,
      hash: CRYPTO_CONSTANTS.RSA.HASH,
    },
    true,
    ['decrypt', 'unwrapKey']
  );
}

/**
 * Generate cryptographically secure random bytes in chunks (supporting buffers > 65,536 bytes)
 */
export function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const CHUNK_SIZE = 65536;
  for (let offset = 0; offset < length; offset += CHUNK_SIZE) {
    const slice = bytes.subarray(offset, Math.min(offset + CHUNK_SIZE, length));
    globalThis.crypto.getRandomValues(slice);
  }
  return bytes;
}

/**
 * Derive a 256-bit symmetric key from a password and salt using Argon2id
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  params: Argon2idParams = {
    timeCost: CRYPTO_CONSTANTS.ARGON2ID.TIME_COST,
    memoryCost: CRYPTO_CONSTANTS.ARGON2ID.MEMORY_COST,
    parallelism: CRYPTO_CONSTANTS.ARGON2ID.PARALLELISM,
    hashLength: CRYPTO_CONSTANTS.ARGON2ID.HASH_LENGTH_BYTES,
  }
): Promise<CryptoKey> {
  // Use hash-wasm Argon2id WebAssembly implementation
  const derivedBytes = await argon2id({
    password,
    salt,
    iterations: params.timeCost,
    memorySize: params.memoryCost,
    hashLength: params.hashLength,
    parallelism: params.parallelism,
    outputType: 'binary',
  });

  // Import as AES-GCM CryptoKey
  return await subtle.importKey(
    'raw',
    derivedBytes as unknown as BufferSource,
    { name: CRYPTO_CONSTANTS.AES_GCM.ALGORITHM },
    false, // derived key is not extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Protect a user's RSA-OAEP private key by encrypting it with an Argon2id-derived AES-GCM key.
 */
export async function protectPrivateKey(
  privateKey: CryptoKey,
  password: string,
  customParams?: Partial<Argon2idParams>
): Promise<{
  encryptedPrivateKey: Uint8Array;
  salt: Uint8Array;
  nonce: Uint8Array;
  kdfParams: Argon2idParams;
}> {
  const kdfParams: Argon2idParams = {
    timeCost: customParams?.timeCost ?? CRYPTO_CONSTANTS.ARGON2ID.TIME_COST,
    memoryCost: customParams?.memoryCost ?? CRYPTO_CONSTANTS.ARGON2ID.MEMORY_COST,
    parallelism: customParams?.parallelism ?? CRYPTO_CONSTANTS.ARGON2ID.PARALLELISM,
    hashLength: customParams?.hashLength ?? CRYPTO_CONSTANTS.ARGON2ID.HASH_LENGTH_BYTES,
  };

  const salt = generateRandomBytes(CRYPTO_CONSTANTS.ARGON2ID.SALT_LENGTH_BYTES);
  const nonce = generateRandomBytes(CRYPTO_CONSTANTS.AES_GCM.NONCE_LENGTH_BYTES);

  // Derive AES key
  const aesKey = await deriveKeyFromPassword(password, salt, kdfParams);

  // Export private key to PKCS8
  const pkcs8Bytes = await exportPrivateKey(privateKey);

  // Encrypt with AES-256-GCM
  const ciphertextBuffer = await subtle.encrypt(
    {
      name: CRYPTO_CONSTANTS.AES_GCM.ALGORITHM,
      iv: nonce as unknown as BufferSource,
      tagLength: CRYPTO_CONSTANTS.AES_GCM.TAG_LENGTH_BITS,
    },
    aesKey,
    pkcs8Bytes as unknown as BufferSource
  );

  return {
    encryptedPrivateKey: new Uint8Array(ciphertextBuffer),
    salt,
    nonce,
    kdfParams,
  };
}

/**
 * Unlock and restore a user's RSA-OAEP private key in client memory
 */
export async function unlockPrivateKey(
  encryptedPrivateKey: Uint8Array,
  salt: Uint8Array,
  nonce: Uint8Array,
  password: string,
  kdfParams: Argon2idParams
): Promise<CryptoKey> {
  const aesKey = await deriveKeyFromPassword(password, salt, kdfParams);

  const decryptedBuffer = await subtle.decrypt(
    {
      name: CRYPTO_CONSTANTS.AES_GCM.ALGORITHM,
      iv: nonce as unknown as BufferSource,
      tagLength: CRYPTO_CONSTANTS.AES_GCM.TAG_LENGTH_BITS,
    },
    aesKey,
    encryptedPrivateKey as unknown as BufferSource
  );

  return await importPrivateKey(new Uint8Array(decryptedBuffer));
}

/**
 * Wrap a secret key (such as a 32-byte DEK or workspace search key) using the recipient's RSA-OAEP public key
 */
export async function wrapKeyForRecipient(
  recipientPublicKey: CryptoKey,
  secretKeyBytes: Uint8Array
): Promise<Uint8Array> {
  const encryptedBuffer = await subtle.encrypt(
    {
      name: CRYPTO_CONSTANTS.RSA.ALGORITHM,
    },
    recipientPublicKey,
    secretKeyBytes as unknown as BufferSource
  );
  return new Uint8Array(encryptedBuffer);
}

/**
 * Unwrap a secret key using the user's RSA-OAEP private key
 */
export async function unwrapKeyForUser(
  userPrivateKey: CryptoKey,
  wrappedKeyBytes: Uint8Array
): Promise<Uint8Array> {
  const decryptedBuffer = await subtle.decrypt(
    {
      name: CRYPTO_CONSTANTS.RSA.ALGORITHM,
    },
    userPrivateKey,
    wrappedKeyBytes as unknown as BufferSource
  );
  return new Uint8Array(decryptedBuffer);
}
