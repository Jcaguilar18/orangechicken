"use strict";
// decryptor.ts
// calls enc-dec.app to decrypt videasy's encrypted blob.
// the blob is plain text hex returned directly from api.videasy.net.
// enc-dec.app handles the wasm/cryptojs decryption server-side.
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptResponse = decryptResponse;
const DEC_API = 'https://enc-dec.app/api/dec-videasy';
// simple in-memory cache: key = `${tmdbId}:${blobHash}`, value = decrypted payload
// avoids re-calling the api for the same blob within a server session
const cache = new Map();
function blobKey(tmdbId, blob) {
    // soo i think it's better to use first 32 chars of blob as a cheap fingerprint as blobs are unique per request
    return `${tmdbId}:${blob.slice(0, 32)}`;
}
async function decryptResponse(blob, tmdbId) {
    if (!blob || blob.length < 10)
        return null;
    const key = blobKey(tmdbId, blob);
    if (cache.has(key))
        return cache.get(key);
    try {
        const res = await fetch(DEC_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: blob, id: tmdbId })
        });
        if (!res.ok)
            return null;
        const json = (await res.json());
        if (json.status !== 200 || !json.result?.sources)
            return null;
        const payload = {
            sources: json.result.sources ?? [],
            subtitles: json.result.subtitles ?? []
        };
        cache.set(key, payload);
        return payload;
    }
    catch {
        return null;
    }
}
