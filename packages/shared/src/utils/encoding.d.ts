/**
 * Universal binary encoding utilities for Node.js and Browser environments
 */
export declare function uint8ArrayToBase64(bytes: Uint8Array): string;
export declare function base64ToUint8Array(base64: string): Uint8Array;
export declare function uint8ArrayToBase64Url(bytes: Uint8Array): string;
export declare function base64UrlToUint8Array(base64url: string): Uint8Array;
export declare function uint8ArrayToHex(bytes: Uint8Array): string;
export declare function hexToUint8Array(hex: string): Uint8Array;
export declare function utf8ToUint8Array(str: string): Uint8Array;
export declare function uint8ArrayToUtf8(bytes: Uint8Array): string;
/**
 * Constant-time comparison for byte arrays to prevent timing attacks
 */
export declare function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;
