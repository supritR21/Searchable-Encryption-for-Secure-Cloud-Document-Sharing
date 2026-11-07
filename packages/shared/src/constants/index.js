"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRYPTO_CONSTANTS = void 0;
exports.CRYPTO_CONSTANTS = {
    // RSA-OAEP Key Specification
    RSA: {
        ALGORITHM: 'RSA-OAEP',
        MODULUS_LENGTH: 3072, // 3072 bits as per project spec
        PUBLIC_EXPONENT: new Uint8Array([0x01, 0x00, 0x01]), // 65537
        HASH: 'SHA-256',
    },
    // AES-256-GCM Specification
    AES_GCM: {
        ALGORITHM: 'AES-GCM',
        KEY_LENGTH_BITS: 256,
        KEY_LENGTH_BYTES: 32,
        NONCE_LENGTH_BYTES: 12, // 96-bit nonce
        TAG_LENGTH_BITS: 128, // 16 bytes auth tag
    },
    // HMAC-SHA-256 Specification
    HMAC: {
        ALGORITHM: 'HMAC',
        HASH: 'SHA-256',
        OUTPUT_LENGTH_BYTES: 32,
    },
    // Client-Side & Server-Side Argon2id Specification
    ARGON2ID: {
        TIME_COST: 3, // 3 iterations
        MEMORY_COST: 65536, // 64 MB
        PARALLELISM: 1, // 1 lane
        HASH_LENGTH_BYTES: 32, // 256-bit derived key
        SALT_LENGTH_BYTES: 16, // 128-bit salt
    },
    // Scope limits
    LIMITS: {
        MAX_UPLOAD_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB per document
        MAX_TERMS_PER_DOCUMENT: 2000,
        ALLOWED_MIME_TYPES: ['application/pdf', 'text/plain'],
    },
    // Prefixes for domain separation
    PREFIXES: {
        TOKEN: 'ciphershare|',
        AAD: 'ciphershare-aad|',
    },
    VERSIONS: {
        CRYPTO_VERSION: 1,
        KEY_VERSION: 1,
    },
};
