"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDocumentAAD = buildDocumentAAD;
exports.encryptDocument = encryptDocument;
exports.decryptDocument = decryptDocument;
exports.encryptMetadata = encryptMetadata;
exports.decryptMetadata = decryptMetadata;
const index_js_1 = require("../constants/index.js");
const encoding_js_1 = require("../utils/encoding.js");
const key_management_js_1 = require("./key-management.js");
const subtle = globalThis.crypto.subtle;
/**
 * Generate a versioned Additional Authenticated Data (AAD) byte array bound to workspace and document IDs.
 * Prevents cut-and-paste attacks between different workspaces or documents.
 */
function buildDocumentAAD(workspaceId, documentId, version = 1) {
    const aadString = `${index_js_1.CRYPTO_CONSTANTS.PREFIXES.AAD}v${version}|${workspaceId}|${documentId}`;
    return (0, encoding_js_1.utf8ToUint8Array)(aadString);
}
/**
 * Import a 32-byte raw DEK as an AES-GCM CryptoKey
 */
async function importAesKey(rawKey) {
    if (rawKey.byteLength !== index_js_1.CRYPTO_CONSTANTS.AES_GCM.KEY_LENGTH_BYTES) {
        throw new Error(`Invalid DEK length: expected ${index_js_1.CRYPTO_CONSTANTS.AES_GCM.KEY_LENGTH_BYTES} bytes, got ${rawKey.byteLength}`);
    }
    return await subtle.importKey('raw', rawKey, { name: index_js_1.CRYPTO_CONSTANTS.AES_GCM.ALGORITHM }, false, ['encrypt', 'decrypt']);
}
/**
 * Encrypt document bytes using AES-256-GCM with a fresh random 12-byte nonce and bound AAD.
 * Web Crypto API appends the 16-byte authentication tag to the ciphertext buffer.
 */
async function encryptDocument(fileBytes, dek, workspaceId, documentId) {
    if (fileBytes.byteLength > index_js_1.CRYPTO_CONSTANTS.LIMITS.MAX_UPLOAD_SIZE_BYTES) {
        throw new Error(`File size exceeds maximum allowed upload limit of ${index_js_1.CRYPTO_CONSTANTS.LIMITS.MAX_UPLOAD_SIZE_BYTES} bytes`);
    }
    const nonce = (0, key_management_js_1.generateRandomBytes)(index_js_1.CRYPTO_CONSTANTS.AES_GCM.NONCE_LENGTH_BYTES);
    const aad = buildDocumentAAD(workspaceId, documentId);
    const key = await importAesKey(dek);
    const encryptedBuffer = await subtle.encrypt({
        name: index_js_1.CRYPTO_CONSTANTS.AES_GCM.ALGORITHM,
        iv: nonce,
        additionalData: aad,
        tagLength: index_js_1.CRYPTO_CONSTANTS.AES_GCM.TAG_LENGTH_BITS,
    }, key, fileBytes);
    return {
        ciphertext: new Uint8Array(encryptedBuffer),
        nonce,
    };
}
/**
 * Decrypt document bytes using AES-256-GCM, verifying authentication tag and AAD.
 * Throws OperationError if ciphertext was modified or keys/AAD do not match.
 */
async function decryptDocument(ciphertext, nonce, dek, workspaceId, documentId) {
    const aad = buildDocumentAAD(workspaceId, documentId);
    const key = await importAesKey(dek);
    const decryptedBuffer = await subtle.decrypt({
        name: index_js_1.CRYPTO_CONSTANTS.AES_GCM.ALGORITHM,
        iv: nonce,
        additionalData: aad,
        tagLength: index_js_1.CRYPTO_CONSTANTS.AES_GCM.TAG_LENGTH_BITS,
    }, key, ciphertext);
    return new Uint8Array(decryptedBuffer);
}
/**
 * Encrypt document metadata (filename, mime type, size, timestamps) using AES-256-GCM with a separate nonce.
 */
async function encryptMetadata(metadata, dek) {
    const nonce = (0, key_management_js_1.generateRandomBytes)(index_js_1.CRYPTO_CONSTANTS.AES_GCM.NONCE_LENGTH_BYTES);
    const jsonStr = JSON.stringify(metadata);
    const dataBytes = (0, encoding_js_1.utf8ToUint8Array)(jsonStr);
    const key = await importAesKey(dek);
    const encryptedBuffer = await subtle.encrypt({
        name: index_js_1.CRYPTO_CONSTANTS.AES_GCM.ALGORITHM,
        iv: nonce,
        tagLength: index_js_1.CRYPTO_CONSTANTS.AES_GCM.TAG_LENGTH_BITS,
    }, key, dataBytes);
    return {
        encryptedMetadata: new Uint8Array(encryptedBuffer),
        nonce,
    };
}
/**
 * Decrypt document metadata and return parsed DocumentMetadata
 */
async function decryptMetadata(encryptedMetadata, nonce, dek) {
    const key = await importAesKey(dek);
    const decryptedBuffer = await subtle.decrypt({
        name: index_js_1.CRYPTO_CONSTANTS.AES_GCM.ALGORITHM,
        iv: nonce,
        tagLength: index_js_1.CRYPTO_CONSTANTS.AES_GCM.TAG_LENGTH_BITS,
    }, key, encryptedMetadata);
    const jsonStr = (0, encoding_js_1.uint8ArrayToUtf8)(new Uint8Array(decryptedBuffer));
    return JSON.parse(jsonStr);
}
