"use strict";
/**
 * Universal binary encoding utilities for Node.js and Browser environments
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.uint8ArrayToBase64 = uint8ArrayToBase64;
exports.base64ToUint8Array = base64ToUint8Array;
exports.uint8ArrayToBase64Url = uint8ArrayToBase64Url;
exports.base64UrlToUint8Array = base64UrlToUint8Array;
exports.uint8ArrayToHex = uint8ArrayToHex;
exports.hexToUint8Array = hexToUint8Array;
exports.utf8ToUint8Array = utf8ToUint8Array;
exports.uint8ArrayToUtf8 = uint8ArrayToUtf8;
exports.timingSafeEqual = timingSafeEqual;
function uint8ArrayToBase64(bytes) {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(bytes).toString('base64');
    }
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}
function base64ToUint8Array(base64) {
    if (typeof Buffer !== 'undefined') {
        const buf = Buffer.from(base64, 'base64');
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}
function uint8ArrayToBase64Url(bytes) {
    return uint8ArrayToBase64(bytes)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}
function base64UrlToUint8Array(base64url) {
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    return base64ToUint8Array(base64);
}
function uint8ArrayToHex(bytes) {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
function hexToUint8Array(hex) {
    const cleanHex = hex.replace(/^0x/, '');
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
    }
    return bytes;
}
function utf8ToUint8Array(str) {
    return new TextEncoder().encode(str);
}
function uint8ArrayToUtf8(bytes) {
    return new TextDecoder('utf-8').decode(bytes);
}
/**
 * Constant-time comparison for byte arrays to prevent timing attacks
 */
function timingSafeEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a[i] ^ b[i];
    }
    return diff === 0;
}
