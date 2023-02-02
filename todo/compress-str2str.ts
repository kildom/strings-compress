

import * as fs from 'fs';

const HASH_BITS = 15;
const HASH_MAX = (1 << HASH_BITS) - 1;
const HASH_CONST = 31321;
const HASH_CONST_POW2 = (HASH_CONST * HASH_CONST) & HASH_MAX;
const HASH_CONST_POW3 = (HASH_CONST_POW2 * HASH_CONST) & HASH_MAX;

function updateHash(hash: number, input: number, output: number) {
    return (((hash - HASH_CONST_POW3 * output) & HASH_MAX) * HASH_CONST + input) & HASH_MAX
}

function expectTrue(x: boolean) {
    if (!x) {
        throw new Error('Assertion failed');
    } else {
        console.log('OK');
    }
}

function expectEq(a: any, b: any) {
    if (a != b) {
        throw new Error(`Not equal: "${a}" != "${b}"`);
    } else {
        console.log('OK');
    }
}

function matching(data: Uint8Array, pastPos: number, pos: number, maxCount: number) {
    let n = 0;
    let result = 0;
    while (pos + n < data.length) {
        if ((data[pastPos + n] >> 6) !== 2) {
            result = n;
        }
        if (data[pastPos + n] != data[pos + n] || n >= maxCount) {
            return result;
        }
        n++;
    }
    return n;
}

function test_matching() {
    let e = new TextEncoder();
    expectEq(3, matching(e.encode('abcdefabcx'), 0, 6, 256));
    expectEq(2, matching(e.encode('abcdefabcx'), 1, 7, 256));
    expectEq(0, matching(e.encode('abcdefabcx'), 0, 7, 256));
    expectEq(3, matching(e.encode('abcdefabc'), 0, 6, 256));
    expectEq(6, matching(e.encode('aaaaaaab'), 0, 1, 256));
    expectEq(5, matching(e.encode('aaaaaaab'), 0, 1, 5));
    expectEq(2, matching(e.encode('Źółty,Źòłty'), 0, 9, 256));
    expectEq(2, matching(e.encode('Źółty,Źòłty'), 0, 9, 3));
    expectEq(2, matching(e.encode('Źółty,Źòłty'), 0, 9, 2));
    expectEq(0, matching(e.encode('Źółty,Źòłty'), 0, 9, 1));
    expectEq(5, matching(e.encode('I am 😀. I am 😍.'), 0, 11, 10));
    expectEq(5, matching(e.encode('I am 😀. I am 😍.'), 0, 11, 9));
    expectEq(5, matching(e.encode('I am 😀. I am 😍.'), 0, 11, 8));
    expectEq(5, matching(e.encode('I am 😀. I am 😍.'), 0, 11, 5));
    expectEq(4, matching(e.encode('I am 😀. I am 😍.'), 0, 11, 4));
    expectEq(10, matching(e.encode('I am 😀. I am 😀.'), 0, 11, 256));
    expectEq(10, matching(e.encode('I am 😀. I am 😀.'), 0, 11, 10));
    expectEq(9, matching(e.encode('I am 😀. I am 😀.'), 0, 11, 9));
    expectEq(5, matching(e.encode('I am 😀. I am 😀.'), 0, 11, 8));
}

//test_matching(); process.exit();

function str2strCompress(text: string): string {
    const data = new TextEncoder().encode(text);
    const output = new Uint8Array(2 * data.length);
    let outputPos = 0;
    console.log(text.length);
    console.log(data.length);

    const maxOffset = 65536;
    const maxCount = 256;

    const offsetToChars = new Uint8Array(maxOffset).fill(2);
    const countToChars = new Uint8Array(maxCount).fill(2);
    const escapeLiterals: Uint8Array[] = [];

    const hashTable: number[][] = Array.from({ length: HASH_MAX + 1 }, () => []);

    let hash = updateHash(0, data[0], 0);
    hash = updateHash(hash, data[1], 0);
    hash = updateHash(hash, data[2], 0);
    hash = updateHash(hash, data[3], 0);

    let pos = 0;

    let t = 0;

    while (pos + 4 < data.length) {
        // get past occurrences of the hash
        let past = hashTable[hash];
        // remove occurrences that are to old
        if (past.length > 0 && pos - past[0] > 4 * maxOffset) {
            let i = 1;
            while (i < past.length && pos - past[i] > maxOffset) {
                i++;
            }
            past.splice(0, i);
        }
        // Find best occurrences
        let bestScore = 2;
        let bestCount = 0;
        let bestOffset = 0;
        for (let pastPos of past) {
            let offset = pos - pastPos;
            let count = matching(data, pastPos, pos, maxCount);
            let chars = Math.max(countToChars[count], offsetToChars[offset]);
            let score = count - chars;
            if (score >= bestScore) {
                bestScore = score;
                bestCount = count;
                bestOffset = offset;
            }
        }

        let nextPos;

        if (bestCount > 0) {
            console.log(`Repeat ${bestCount} from ${bestOffset}`);
            nextPos = pos + bestCount;
            t = 0;
        } else if (data[pos] < 128 && escapeLiterals[data[pos]]) {
            let esc = escapeLiterals[data[pos]];
            output.set(esc, pos);
            outputPos += esc.length;
            nextPos = pos + 1;
        } else {
            output[outputPos++] = data[pos];
            nextPos = pos + 1;
            while (nextPos < data.length && (data[nextPos] >> 6) === 2) {
                output[outputPos++] = data[nextPos];
                nextPos++;
            }
            t += nextPos - pos;
            console.log(`Literal of length ${nextPos - pos}, total ${t}`);
        }

        while (pos < nextPos) {
            hashTable[hash].push(pos);
            hash = updateHash(hash, data[pos + 4], data[pos]);
            pos++;
        }
    }

    while (pos < data.length) {
        if (data[pos] < 128 && escapeLiterals[data[pos]]) {
            let esc = escapeLiterals[data[pos]];
            output.set(esc, pos);
            outputPos += esc.length;
            pos++;
        } else {
            output[outputPos++] = data[pos];
            pos++;
            while (pos < data.length && (data[pos] >> 6) === 2) {
                output[outputPos++] = data[pos];
                pos++;
            }
            console.log(`Literal`);
        }
    }

    return '';
}

let cnt = fs.readFileSync('../test.txt', 'utf8');
console.log(str2strCompress(cnt));
