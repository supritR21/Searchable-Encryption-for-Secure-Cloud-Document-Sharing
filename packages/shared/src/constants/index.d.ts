export declare const CRYPTO_CONSTANTS: {
    readonly RSA: {
        readonly ALGORITHM: "RSA-OAEP";
        readonly MODULUS_LENGTH: 3072;
        readonly PUBLIC_EXPONENT: Uint8Array<ArrayBuffer>;
        readonly HASH: "SHA-256";
    };
    readonly AES_GCM: {
        readonly ALGORITHM: "AES-GCM";
        readonly KEY_LENGTH_BITS: 256;
        readonly KEY_LENGTH_BYTES: 32;
        readonly NONCE_LENGTH_BYTES: 12;
        readonly TAG_LENGTH_BITS: 128;
    };
    readonly HMAC: {
        readonly ALGORITHM: "HMAC";
        readonly HASH: "SHA-256";
        readonly OUTPUT_LENGTH_BYTES: 32;
    };
    readonly ARGON2ID: {
        readonly TIME_COST: 3;
        readonly MEMORY_COST: 65536;
        readonly PARALLELISM: 1;
        readonly HASH_LENGTH_BYTES: 32;
        readonly SALT_LENGTH_BYTES: 16;
    };
    readonly LIMITS: {
        readonly MAX_UPLOAD_SIZE_BYTES: number;
        readonly MAX_TERMS_PER_DOCUMENT: 2000;
        readonly ALLOWED_MIME_TYPES: readonly ["application/pdf", "text/plain"];
    };
    readonly PREFIXES: {
        readonly TOKEN: "ciphershare|";
        readonly AAD: "ciphershare-aad|";
    };
    readonly VERSIONS: {
        readonly CRYPTO_VERSION: 1;
        readonly KEY_VERSION: 1;
    };
};
