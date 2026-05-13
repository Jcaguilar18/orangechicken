"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = decryptPayload;
const crypto_1 = require("crypto");
const { subtle } = crypto_1.webcrypto;
/**
 * AES-GCM decryption key used by Peachify for encrypted API responses.
 * This key is embedded in their frontend bundle.
 */
const ENCRYPTION_KEY_HEX = 'd8f2a1b5e9c470814f6b2c3a5d8e7f9c1a2b3c4d5e3f7a8b9c0d1e2f3a4d5c6d';
/**
 * Convert a base64url string into bytes.
 */
function base64UrlToBytes(value) {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = Buffer.from(padded, 'base64');
    return new Uint8Array(binary);
}
/**
 * Convert a hex string into bytes.
 */
function hexToBytes(hex) {
    if (hex.length % 2 !== 0) {
        throw new Error('Invalid hex string length');
    }
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
}
/**
 * Import the AES-GCM decryption key.
 */
async function importDecryptionKey() {
    return subtle.importKey('raw', hexToBytes(ENCRYPTION_KEY_HEX), { name: 'AES-GCM' }, false, ['decrypt']);
}
/**
 * Parse the encrypted Peachify payload.
 */
function parsePayload(payload) {
    const parts = payload.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid payload format. Expected: iv.ciphertext.authTag');
    }
    const [ivPart, ciphertextPart, authTagPart] = parts;
    return {
        iv: base64UrlToBytes(ivPart),
        ciphertext: base64UrlToBytes(ciphertextPart),
        authTag: base64UrlToBytes(authTagPart)
    };
}
/**
 * Decrypt a Peachify API response payload.
 */
async function decryptPayload(payload) {
    try {
        const { iv, ciphertext, authTag } = parsePayload(payload);
        // AES-GCM expects ciphertext + auth tag concatenated.
        const encryptedData = new Uint8Array(ciphertext.length + authTag.length);
        encryptedData.set(ciphertext);
        encryptedData.set(authTag, ciphertext.length);
        const key = await importDecryptionKey();
        const decryptedBuffer = await subtle.decrypt({
            name: 'AES-GCM',
            iv
        }, key, encryptedData);
        const decryptedJson = new TextDecoder().decode(decryptedBuffer);
        return JSON.parse(decryptedJson);
    }
    catch (error) {
        console.error('Failed to decrypt Peachify payload. Payload may be invalid or tampered with.', error);
        return null;
    }
}
