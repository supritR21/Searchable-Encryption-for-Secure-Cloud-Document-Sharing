import { Argon2idParams } from '../types/index.js';
/**
 * Generate an RSA-OAEP 3072-bit key pair for user identity and key wrapping.
 */
export declare function generateUserKeyPair(): Promise<CryptoKeyPair>;
/**
 * Export public key to SPKI binary format
 */
export declare function exportPublicKey(publicKey: CryptoKey): Promise<Uint8Array>;
/**
 * Export private key to PKCS8 binary format
 */
export declare function exportPrivateKey(privateKey: CryptoKey): Promise<Uint8Array>;
/**
 * Import SPKI public key
 */
export declare function importPublicKey(spkiBytes: Uint8Array): Promise<CryptoKey>;
/**
 * Import PKCS8 private key
 */
export declare function importPrivateKey(pkcs8Bytes: Uint8Array): Promise<CryptoKey>;
/**
 * Generate cryptographically secure random bytes in chunks (supporting buffers > 65,536 bytes)
 */
export declare function generateRandomBytes(length: number): Uint8Array;
/**
 * Derive a 256-bit symmetric key from a password and salt using Argon2id
 */
export declare function deriveKeyFromPassword(password: string, salt: Uint8Array, params?: Argon2idParams): Promise<CryptoKey>;
/**
 * Protect a user's RSA-OAEP private key by encrypting it with an Argon2id-derived AES-GCM key.
 */
export declare function protectPrivateKey(privateKey: CryptoKey, password: string, customParams?: Partial<Argon2idParams>): Promise<{
    encryptedPrivateKey: Uint8Array;
    salt: Uint8Array;
    nonce: Uint8Array;
    kdfParams: Argon2idParams;
}>;
/**
 * Unlock and restore a user's RSA-OAEP private key in client memory
 */
export declare function unlockPrivateKey(encryptedPrivateKey: Uint8Array, salt: Uint8Array, nonce: Uint8Array, password: string, kdfParams: Argon2idParams): Promise<CryptoKey>;
/**
 * Wrap a secret key (such as a 32-byte DEK or workspace search key) using the recipient's RSA-OAEP public key
 */
export declare function wrapKeyForRecipient(recipientPublicKey: CryptoKey, secretKeyBytes: Uint8Array): Promise<Uint8Array>;
/**
 * Unwrap a secret key using the user's RSA-OAEP private key
 */
export declare function unwrapKeyForUser(userPrivateKey: CryptoKey, wrappedKeyBytes: Uint8Array): Promise<Uint8Array>;
