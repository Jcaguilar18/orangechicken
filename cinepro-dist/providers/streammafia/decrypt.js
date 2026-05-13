"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptStreamMafia = decryptStreamMafia;
const crypto_1 = require("crypto");
function base64ToBuffer(b64) {
    return Buffer.from(b64, 'base64');
}
function deriveKey(secret) {
    return (0, crypto_1.createHash)('sha256').update(secret).digest();
}
function decryptStreamMafia(payload) {
    try {
        const iv = base64ToBuffer(payload.iv);
        const tag = base64ToBuffer(payload.tag);
        const data = base64ToBuffer(payload.data);
        const key = deriveKey('Z9#rL!v2K*5qP&7mXw');
        const decipher = (0, crypto_1.createDecipheriv)('aes-256-gcm', key, iv);
        // attach auth tag
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([
            decipher.update(data),
            decipher.final()
        ]);
        const jsonString = decrypted.toString('utf-8');
        if (!jsonString) {
            throw new Error('Empty decrypted result');
        }
        return JSON.parse(jsonString);
    }
    catch (err) {
        throw new Error('Failed to decrypt StreamMafia response');
    }
}
