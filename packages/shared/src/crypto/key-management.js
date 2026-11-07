"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUserKeyPair = generateUserKeyPair;
exports.exportPublicKey = exportPublicKey;
exports.exportPrivateKey = exportPrivateKey;
exports.importPublicKey = importPublicKey;
exports.importPrivateKey = importPrivateKey;
exports.generateRandomBytes = generateRandomBytes;
exports.deriveKeyFromPassword = deriveKeyFromPassword;
exports.protectPrivateKey = protectPrivateKey;
exports.unlockPrivateKey = unlockPrivateKey;
exports.wrapKeyForRecipient = wrapKeyForRecipient;
exports.unwrapKeyForUser = unwrapKeyForUser;
const index_js_1 = require("../constants/index.js");
const hash_wasm_1 = require("hash-wasm");
const subtle = globalThis.crypto.subtle;
/**
 * Generate an RSA-OAEP 3072-bit key pair for user identity and key wrapping.
 */
async function generateUserKeyPair() {
    const rsaParams = {
        name: index_js_1.CRYPTO_CONSTANTS.RSA.ALGORITHM,
        modulusLength: index_js_1.CRYPTO_CONSTANTS.RSA.MODULUS_LENGTH,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
        hash: index_js_1.CRYPTO_CONSTANTS.RSA.HASH,
    };
    return (await subtle.generateKey(rsaParams, true, // extractable
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']));
}
/**
 * Export public key to SPKI binary format
 */
async function exportPublicKey(publicKey) {
    const spki = await subtle.exportKey('spki', publicKey);
    return new Uint8Array(spki);
}
/**
 * Export private key to PKCS8 binary format
 */
async function exportPrivateKey(privateKey) {
    const pkcs8 = await subtle.exportKey('pkcs8', privateKey);
    return new Uint8Array(pkcs8);
}
/**
 * Import SPKI public key
 */
async function importPublicKey(spkiBytes) {
    return await subtle.importKey('spki', spkiBytes, {
        name: index_js_1.CRYPTO_CONSTANTS.RSA.ALGORITHM,
        hash: index_js_1.CRYPTO_CONSTANTS.RSA.HASH,
    }, true, ['encrypt', 'wrapKey']);
}
/**
 * Import PKCS8 private key
 */
async function importPrivateKey(pkcs8Bytes) {
    return await subtle.importKey('pkcs8', pkcs8Bytes, {
        name: index_js_1.CRYPTO_CONSTANTS.RSA.ALGORITHM,
        hash: index_js_1.CRYPTO_CONSTANTS.RSA.HASH,
    }, true, ['decrypt', 'unwrapKey']);
}
/**
 * Generate cryptographically secure random bytes in chunks (supporting buffers > 65,536 bytes)
 */
function generateRandomBytes(length) {
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
async function deriveKeyFromPassword(password, salt, params = {
    timeCost: index_js_1.CRYPTO_CONSTANTS.ARGON2ID.TIME_COST,
    memoryCost: index_js_1.CRYPTO_CONSTANTS.ARGON2ID.MEMORY_COST,
    parallelism: index_js_1.CRYPTO_CONSTANTS.ARGON2ID.PARALLELISM,
    hashLength: index_js_1.CRYPTO_CONSTANTS.ARGON2ID.HASH_LENGTH_BYTES,
}) {
    // Use hash-wasm Argon2id WebAssembly implementation
    const derivedBytes = await (0, hash_wasm_1.argon2id)({
        password,
        salt,
        iterations: params.timeCost,
        memorySize: params.memoryCost,
        hashLength: params.hashLength,
        parallelism: params.parallelism,
        outputType: 'binary',
    });
    // Import as AES-GCM CryptoKey
    return await subtle.importKey('raw', derivedBytes, { name: index_js_1.CRYPTO_CONSTANTS.AES_GCM.ALGORITHM }, false, // derived key is not extractable
    ['encrypt', 'decrypt']);
}
/**
 * Protect a user's RSA-OAEP private key by encrypting it with an Argon2id-derived AES-GCM key.
 */
async function protectPrivateKey(privateKey, password, customParams) {
    const kdfParams = {
        timeCost: customParams?.timeCost ?? index_js_1.CRYPTO_CONSTANTS.ARGON2ID.TIME_COST,
        memoryCost: customParams?.memoryCost ?? index_js_1.CRYPTO_CONSTANTS.ARGON2ID.MEMORY_COST,
        parallelism: customParams?.parallelism ?? index_js_1.CRYPTO_CONSTANTS.ARGON2ID.PARALLELISM,
        hashLength: customParams?.hashLength ?? index_js_1.CRYPTO_CONSTANTS.ARGON2ID.HASH_LENGTH_BYTES,
    };
    const salt = generateRandomBytes(index_js_1.CRYPTO_CONSTANTS.ARGON2ID.SALT_LENGTH_BYTES);
    const nonce = generateRandomBytes(index_js_1.CRYPTO_CONSTANTS.AES_GCM.NONCE_LENGTH_BYTES);
    // Derive AES key
    const aesKey = await deriveKeyFromPassword(password, salt, kdfParams);
    // Export private key to PKCS8
    const pkcs8Bytes = await exportPrivateKey(privateKey);
    // Encrypt with AES-256-GCM
    const ciphertextBuffer = await subtle.encrypt({
        name: index_js_1.CRYPTO_CONSTANTS.AES_GCM.ALGORITHM,
        iv: nonce,
        tagLength: index_js_1.CRYPTO_CONSTANTS.AES_GCM.TAG_LENGTH_BITS,
    }, aesKey, pkcs8Bytes);
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
async function unlockPrivateKey(encryptedPrivateKey, salt, nonce, password, kdfParams) {
    const aesKey = await deriveKeyFromPassword(password, salt, kdfParams);
    const decryptedBuffer = await subtle.decrypt({
        name: index_js_1.CRYPTO_CONSTANTS.AES_GCM.ALGORITHM,
        iv: nonce,
        tagLength: index_js_1.CRYPTO_CONSTANTS.AES_GCM.TAG_LENGTH_BITS,
    }, aesKey, encryptedPrivateKey);
    return await importPrivateKey(new Uint8Array(decryptedBuffer));
}
/**
 * Wrap a secret key (such as a 32-byte DEK or workspace search key) using the recipient's RSA-OAEP public key
 */
async function wrapKeyForRecipient(recipientPublicKey, secretKeyBytes) {
    const encryptedBuffer = await subtle.encrypt({
        name: index_js_1.CRYPTO_CONSTANTS.RSA.ALGORITHM,
    }, recipientPublicKey, secretKeyBytes);
    return new Uint8Array(encryptedBuffer);
}
/**
 * Unwrap a secret key using the user's RSA-OAEP private key
 */
async function unwrapKeyForUser(userPrivateKey, wrappedKeyBytes) {
    const decryptedBuffer = await subtle.decrypt({
        name: index_js_1.CRYPTO_CONSTANTS.RSA.ALGORITHM,
    }, userPrivateKey, wrappedKeyBytes);
    return new Uint8Array(decryptedBuffer);
}
