"use strict";
// jsunpack.ts
Object.defineProperty(exports, "__esModule", { value: true });
class Unbase {
    ALPHABET_62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    ALPHABET_95 = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
    radix;
    alphabet = null;
    dictionary = {};
    constructor(radix) {
        this.radix = radix;
        if (radix > 36) {
            if (radix < 62) {
                this.alphabet = this.ALPHABET_62.substring(0, radix);
            }
            else if (radix > 62 && radix < 95) {
                this.alphabet = this.ALPHABET_95.substring(0, radix);
            }
            else if (radix === 62) {
                this.alphabet = this.ALPHABET_62;
            }
            else if (radix === 95) {
                this.alphabet = this.ALPHABET_95;
            }
            if (this.alphabet) {
                for (let i = 0; i < this.alphabet.length; i++) {
                    this.dictionary[this.alphabet[i]] = i;
                }
            }
        }
    }
    unbase(str) {
        if (this.alphabet === null) {
            return parseInt(str, this.radix);
        }
        const tmp = str.split('').reverse().join('');
        let ret = 0;
        for (let i = 0; i < tmp.length; i++) {
            ret += Math.pow(this.radix, i) * (this.dictionary[tmp[i]] ?? 0);
        }
        return ret;
    }
}
class JsUnpacker {
    packedJS;
    constructor(packedJS) {
        this.packedJS = packedJS;
    }
    // returns true if the input looks like p.a.c.k.e.r encoded js
    detect() {
        const js = this.packedJS.replace(/\s/g, '');
        return /eval\(function\(p,a,c,k,e,(?:r|d)/.test(js);
    }
    // decodes packed js back to readable source
    unpack() {
        const js = this.packedJS;
        try {
            const regex = /}\s*\('(.*)',\s*(.*?),\s*(\d+),\s*'(.*?)'\.split\('\|'\)/s;
            const match = js.match(regex);
            if (!match || match.length !== 5)
                return null;
            let payload = match[1].replace(/\\'/g, "'");
            const radix = parseInt(match[2]) || 36;
            const count = parseInt(match[3]) || 0;
            const symtab = match[4].split('|');
            if (symtab.length !== count)
                return null;
            const unbase = new Unbase(radix);
            const wordRegex = /\b\w+\b/g;
            let decoded = payload;
            let replaceOffset = 0;
            let wordMatch;
            while ((wordMatch = wordRegex.exec(payload)) !== null) {
                const word = wordMatch[0];
                const x = unbase.unbase(word);
                const value = x < symtab.length ? symtab[x] : null;
                if (value && value.length > 0) {
                    const start = wordMatch.index + replaceOffset;
                    const end = start + word.length;
                    decoded =
                        decoded.substring(0, start) +
                            value +
                            decoded.substring(end);
                    replaceOffset += value.length - word.length;
                }
            }
            return decoded;
        }
        catch {
            return null;
        }
    }
}
exports.default = JsUnpacker;
