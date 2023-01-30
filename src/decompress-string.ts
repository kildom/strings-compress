
function decompressString(text: string): string {

    const VALIDATE_HEADER = false;
    const alphabet = new Uint8Array(128);
    const escapeChars = new Uint8Array(128);
    const maxOffsets = new Uint32Array(6);
    const maxCounts = new Uint32Array(6);
    const escapedLiterals: number[][] = new Array(6);
    const startLiterals = new Uint32Array(6);
    const startExtended = new Uint32Array(6);
    let outputLength = 0;
    let expectedLength = 0;
    let pos = 0;
    let base = 0;

    const corrupted = function () {
        throw new Error('Corrupted input');
    }

    function decodeSimpleInt(pos: number, length: number): number {
        let result = 0;
        if (VALIDATE_HEADER && pos + length > text.length) {
            corrupted();
        }
        for (let i = 0; i < length; i++) {
            let code = text.charCodeAt(pos + i);
            if (VALIDATE_HEADER && code >= 128) {
                corrupted();
            }
            let value = alphabet[code];
            if (VALIDATE_HEADER && value === 0xFF) {
                corrupted();
            }
            result = result * base + value;
        }
        return result;
    }

    function decodeHeader() {
        alphabet.fill(0xFF);
        pos = 0;
        do {
            if (VALIDATE_HEADER && pos >= text.length) {
                corrupted();
            }
            let c = text.charCodeAt(pos);
            if (VALIDATE_HEADER && c >= 128) {
                corrupted();
            }
            if (alphabet[c] === 0xFF) {
                alphabet[c] = pos & 0xFF;
            } else {
                break;
            }
            pos++;
        } while (true);
        escapeChars.fill(0xFF);
        base = pos;
        let endingCharCode = text.charCodeAt(pos);
        while (true) {
            if (VALIDATE_HEADER && pos >= text.length) {
                corrupted();
            }
            let c = text.charCodeAt(pos);
            if (c === endingCharCode && pos !== base) {
                pos++;
                break;
            } else if (VALIDATE_HEADER && c >= 128) {
                corrupted();
            }
            escapeChars[c] = (pos - base) & 0xFF;
            pos++;

        }
        maxOffsets[0] = 0;
        maxOffsets[1] = 0;
        for (let i = 2; i < 6; i++) {
            maxOffsets[i] = decodeSimpleInt(pos, 3);
            pos += 3;
            if (VALIDATE_HEADER && (maxOffsets[i] < 1 || maxOffsets[i] > 65536
                || maxOffsets[i] < maxOffsets[i - 1])) {
                corrupted();
            }
        }
        maxCounts[0] = 0;
        maxCounts[1] = 0;
        for (let i = 2; i < 6; i++) {
            maxCounts[i] = decodeSimpleInt(pos, 2);
            pos += 2;
            if (VALIDATE_HEADER && (maxCounts[i] < 4 || maxCounts[i] > 256
                || maxCounts[i] < maxCounts[i - 1])) {
                corrupted();
            }
        }
        escapedLiterals[0] = [];
        escapedLiterals[1] = [];
        for (let i = 2; i < 6; i++) {
            let count = decodeSimpleInt(pos, 2);
            pos += 2;
            escapedLiterals[i] = new Array(count);
        }
        let chars = 0;
        let index = 0;
        escapedLiteralsLoop:
        while (true) {
            while (index >= escapedLiterals[chars].length) {
                chars++;
                if (chars >= 6) {
                    break escapedLiteralsLoop;
                }
                index = 0;
            }
            let code = decodeSimpleInt(pos, 2);
            pos += 2;
            escapedLiterals[chars][index++] = code;
        }
        startLiterals[0] = 0;
        startLiterals[1] = 0;
        startExtended[0] = 0;
        startExtended[1] = 0;
        for (let i = 2; i < 6; i++) {
            startLiterals[i] = maxOffsets[i] * (maxCounts[i] - 3);
            startExtended[i] = startLiterals[i] + escapedLiterals[i].length;
        }
        expectedLength = decodeSimpleInt(pos, 6);
        pos += 6;
    }

    decodeHeader();

    const output32 = new Uint32Array(expectedLength);

    main_loop:
    while (pos < text.length) {
        let code = text.charCodeAt(pos++);
        if (code >= 128 || escapeChars[code] == 0xFF) {
            output32[outputLength++] = code;
        } else {
            let value = escapeChars[code];
            let offset: number = 0;
            let count: number = 0;
            let start = outputLength - 1;
            code = alphabet[text.charCodeAt(pos++) & 0x7F];
            value = value * base + code;
            for (let i = 2; i < 6; i++) {
                if (value < startLiterals[i]) {
                    offset = value % maxOffsets[i];
                    count = Math.floor(value / maxOffsets[i]) + 4;
                    break;
                } else if (value < startExtended[i]) {
                    output32[outputLength++] = escapedLiterals[i][value - startLiterals[i]];
                    continue main_loop;
                } else {
                    let code = alphabet[text.charCodeAt(pos++) & 0x7F];
                    value = (value - startExtended[i]) * base + code;
                }
            }
            start -= offset;
            if (start + count <= outputLength) {
                output32.copyWithin(outputLength, start, start + count);
            } else {
                for (let i = 0; i < count; i++) {
                    output32[outputLength + i] += output32[start + i];
                }
            }
            outputLength += count;
        }
    }

    let out = new Uint8Array(output32.buffer);
    let outLen = 0;
    for (let i = 0; i < outputLength; i++) {
        let x = output32[i];
        if (x < 0x80) {
            out[outLen++] = x;
        } else if (x < 0x0800) {
            out[outLen++] = 0xC0 | (x >> 6);
            out[outLen++] = 0x80 | (x & 0x3F);
        } else if (x < 0x010000) {
            out[outLen++] = 0xE0 | (x >> 12);
            out[outLen++] = 0x80 | ((x >> 6) & 0x3F);
            out[outLen++] = 0x80 | (x & 0x3F);
        } else {
            out[outLen++] = 0xF0 | (x >> 18);
            out[outLen++] = 0x80 | ((x >> 12) & 0x3F);
            out[outLen++] = 0x80 | ((x >> 6) & 0x3F);
            out[outLen++] = 0x80 | (x & 0x3F);
        }
    }

    return new TextDecoder().decode(new Uint8Array(out.buffer, 0, outLen));
}
