"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decrypt = decrypt;
const crypto_js_1 = __importDefault(require("crypto-js"));
function decrypt(encryptedText) {
    try {
        const key = Buffer.from('Zk0wdjFlczRVXzIwMjZfU2VjdXJlS2V5X0RvTm90U2hhcmVfdjJfUHJvdGVjdGVk', 'base64').toString('utf-8');
        const decrypted = crypto_js_1.default.AES.decrypt(encryptedText, key);
        const jsonString = decrypted.toString(crypto_js_1.default.enc.Utf8);
        if (!jsonString) {
            throw new Error('Decryption failed - empty result');
        }
        return JSON.parse(jsonString);
    }
    catch (error) {
        throw new Error('Failed to decrypt API response');
    }
}
