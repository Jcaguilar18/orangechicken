"use strict";
// These regex patterns are used that the proxy can identify which urls should be streamed.
// by default the most common video files are included in the @omss/framework
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamPatterns = void 0;
exports.streamPatterns = [
    /pixeldrain\.dev|pixeldra\.in/,
    /hub\.(raj\.lat|toxix\.buzz|oreao-cdn\.buzz)/,
    /wasabisys\.com/,
    /hakunaymatata\.com/,
    /streamflixserver\.site|tripplestream\.online/,
    /illimitableinkwell\.site/,
    /frostcomet5\.pro/,
    /(epimetheus63|earth14|pandora20)\.workers\.dev/, // streammafia's workers.dev proxy domains
    /tiktokcdn\.com/,
    /hlmv\.tripplestream\.online/
];
