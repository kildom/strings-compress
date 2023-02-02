/*

Inflate implementation based on code from fflate (https://github.com/101arrowz/fflate).

------------------------- ORIGINAL COMMENT FROM FFLATE SOURCE CODE -------------------------

// DEFLATE is a complex format; to read this code, you should probably check the RFC first:
// https://tools.ietf.org/html/rfc1951
// You may also wish to take a look at the guide I made about this program:
// https://gist.github.com/101arrowz/253f31eb5abc3d9275ab943003ffecad

// Some of the following code is similar to that of UZIP.js:
// https://github.com/photopea/UZIP.js
// However, the vast majority of the codebase has diverged from UZIP.js to increase performance and reduce bundle size.

// Sometimes 0 will appear where -1 would be more appropriate. This is because using a uint
// is better for memory in most engines (I *think*).

--------------------------------------------------------------------------------------------
*/

// aliases for shorter compressed code (most minifers don't do this)
const u8 = Uint8Array, u16 = Uint16Array, u32 = Uint32Array;

// fixed length extra bits
const fleb = new u8([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, /* unused */ 0, 0, /* impossible */ 0]);

// fixed distance extra bits
// see fleb note
const fdeb = new u8([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, /* unused */ 0, 0]);

// code length index map
const clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);

// get base, reverse index map from extra bits
const freb = (eb: Uint8Array, start: number) => {
  const b = new u16(31);
  for (let i = 0; i < 31; ++i) {
    b[i] = start += 1 << eb[i - 1];
  }
  // numbers here are at max 18 bits
  const r = new u32(b[30]);
  for (let i = 1; i < 30; ++i) {
    for (let j = b[i]; j < b[i + 1]; ++j) {
      r[j] = ((j - b[i]) << 5) | i;
    }
  }
  return [b, r] as const;
}

const [fl, revfl] = freb(fleb, 2);
// we can ignore the fact that the other numbers are wrong; they never happen anyway
fl[28] = 258, revfl[258] = 28;
const [fd] = freb(fdeb, 0);

// map of value to reverse (assuming 16 bits)
const rev = new u16(32768);
for (let i = 0; i < 32768; ++i) {
  // reverse table algorithm from SO
  let x = ((i & 0xAAAA) >>> 1) | ((i & 0x5555) << 1);
  x = ((x & 0xCCCC) >>> 2) | ((x & 0x3333) << 2);
  x = ((x & 0xF0F0) >>> 4) | ((x & 0x0F0F) << 4);
  rev[i] = (((x & 0xFF00) >>> 8) | ((x & 0x00FF) << 8)) >>> 1;
}

// create huffman tree from u8 "map": index -> code length for code index
// mb (max bits) must be at most 15
// TODO: optimize/split up?
const hMap = ((cd: Uint8Array, mb: number, r: 0 | 1) => {
  const s = cd.length;
  // index
  let i = 0;
  // u16 "map": index -> # of codes with bit length = index
  const l = new u16(mb);
  // length of cd must be 288 (total # of codes)
  for (; i < s; ++i) {
    if (cd[i]) ++l[cd[i] - 1];
  }
  // u16 "map": index -> minimum code for bit length = index
  const le = new u16(mb);
  for (i = 0; i < mb; ++i) {
    le[i] = (le[i - 1] + l[i - 1]) << 1;
  }
  let co: Uint16Array;
  if (r) {
    // u16 "map": index -> number of actual bits, symbol for code
    co = new u16(1 << mb);
    // bits to remove for reverser
    const rvb = 15 - mb;
    for (i = 0; i < s; ++i) {
      // ignore 0 lengths
      if (cd[i]) {
        // num encoding both symbol and bits read
        const sv = (i << 4) | cd[i];
        // free bits
        const r = mb - cd[i];
        // start value
        let v = le[cd[i] - 1]++ << r;
        // m is end value
        for (const m = v | ((1 << r) - 1); v <= m; ++v) {
          // every 16 bit value starting with the code yields the same result
          co[rev[v] >>> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i = 0; i < s; ++i) {
      if (cd[i]) {
        co[i] = rev[le[cd[i] - 1]++] >>> (15 - cd[i]);
      }
    }
  }
  return co;
});

// fixed length tree
const flt = new u8(288);
for (let i = 0; i < 144; ++i) flt[i] = 8;
for (let i = 144; i < 256; ++i) flt[i] = 9;
for (let i = 256; i < 280; ++i) flt[i] = 7;
for (let i = 280; i < 288; ++i) flt[i] = 8;
// fixed distance tree
const fdt = new u8(32);
for (let i = 0; i < 32; ++i) fdt[i] = 5;
// fixed length map
const flrm = /*#__PURE__*/ hMap(flt, 9, 1);
// fixed distance map
const fdrm = /*#__PURE__*/ hMap(fdt, 5, 1);

// find max of array
const max = (a: Uint8Array | number[]) => {
  let m = a[0];
  for (let i = 1; i < a.length; ++i) {
    if (a[i] > m) m = a[i];
  }
  return m;
};

// read d, starting at bit p and mask with m
const bits = (d: Uint8Array, p: number, m: number) => {
  const o = (p / 8) | 0;
  return ((d[o] | (d[o + 1] << 8)) >> (p & 7)) & m;
}

// read d, starting at bit p continuing for at least 16 bits
const bits16 = (d: Uint8Array, p: number) => {
  const o = (p / 8) | 0;
  return ((d[o] | (d[o + 1] << 8) | (d[o + 2] << 16)) >> (p & 7));
}

// get end of byte
const shft = (p: number) => ((p + 7) / 8) | 0;

// typed array slice - allows garbage collector to free original reference,
// while being more compatible than .slice
const slc = <T extends Uint8Array | Uint16Array | Uint32Array>(v: T, s: number, e?: number): T => {
  if (s == null || s < 0) s = 0;
  if (e == null || e > v.length) e = v.length;
  // can't use .constructor in case user-supplied
  const n = new (v.BYTES_PER_ELEMENT == 2 ? u16 : v.BYTES_PER_ELEMENT == 4 ? u32 : u8)(e - s) as T;
  n.set(v.subarray(s, e));
  return n;
}

// error codes
const ec = [
  'unexpected EOF',
  'invalid block type',
  'invalid length/literal',
  'invalid distance'
];

const err = (ind: number) => {
  throw new Error(`DEFLATE error ${ind}: ${ec[ind]}`);
}

// expands raw DEFLATE data
const inflt = (dat: Uint8Array, buf: Uint8Array) => {
  // source length
  const sl = dat.length;
  // have to estimate size
  //const noBuf = false;
  // no state
  //const noSt = true = !st || st.i;
  //  last chunk         bitpos           bytes
  let final = 0, pos = 0, bt = 0, lm = undefined, dm = undefined, lbt = undefined, dbt = undefined;
  // total bits
  const tbts = sl * 8;
  do {
    if (!lm) {
      // BFINAL - this is only 1 when last chunk is next
      final = bits(dat, pos, 1);
      // type: 0 = no compression, 1 = fixed huffman, 2 = dynamic huffman
      const type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        // go to end of byte boundary
        const s = shft(pos) + 4, l = dat[s - 4] | (dat[s - 3] << 8), t = s + l;
        if (t > sl) {
          err(0);
          break;
        }
        // Copy over uncompressed data
        buf.set(dat.subarray(s, t), bt);
        // Get new bitpos, update byte count
        bt += l, pos = t * 8;
        continue;
      }
      else if (type == 1) lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
      else if (type == 2) {
        //  literal                            lengths
        const hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
        const tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        // length+distance tree
        const ldt = new u8(tl);
        // code length tree
        const clt = new u8(19);
        for (let i = 0; i < hcLen; ++i) {
          // use index map to get real code
          clt[clim[i]] = bits(dat, pos + i * 3, 7);
        }
        pos += hcLen * 3;
        // code lengths bits
        const clb = max(clt), clbmsk = (1 << clb) - 1;
        // code lengths map
        const clm = hMap(clt, clb, 1);
        for (let i = 0; i < tl;) {
          const r = clm[bits(dat, pos, clbmsk)];
          // bits read
          pos += r & 15;
          // symbol
          const s = r >>> 4;
          // code length to copy
          if (s < 16) {
            ldt[i++] = s;
          } else {
            //  copy   count
            let c = 0, n = 0;
            if (s == 16) n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
            else if (s == 17) n = 3 + bits(dat, pos, 7), pos += 3;
            else if (s == 18) n = 11 + bits(dat, pos, 127), pos += 7;
            while (n--) ldt[i++] = c;
          }
        }
        //    length tree                 distance tree
        const lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
        // max length bits
        lbt = max(lt)
        // max dist bits
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else err(1);
      if (pos > tbts) {
        err(0);
        break;
      }
    }
    // Make sure the buffer can hold this + the largest possible addition
    // Maximum chunk size (practically, theoretically infinite) is 2^17;
    const lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
    let lpos = pos;
    for (; ; lpos = pos) {
      // bits read, code
      const c = lm[bits16(dat, pos) & lms], sym = c >>> 4;
      pos += c & 15;
      if (pos > tbts) {
        err(0);
        break;
      }
      if (!c) err(2);
      if (sym < 256) buf[bt++] = sym;
      else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        let add = sym - 254;
        // no extra bits needed if less
        if (sym > 264) {
          // index
          const i = sym - 257, b = fleb[i];
          add = bits(dat, pos, (1 << b) - 1) + fl[i];
          pos += b;
        }
        // dist
        const d = dm[bits16(dat, pos) & dms], dsym = d >>> 4;
        if (!d) err(3);
        pos += d & 15;
        let dt = fd[dsym];
        if (dsym > 3) {
          const b = fdeb[dsym];
          dt += bits16(dat, pos) & ((1 << b) - 1), pos += b;
        }
        if (pos > tbts) {
          err(0);
          break;
        }
        const end = bt + add;
        for (; bt < end; bt += 4) {
          buf[bt] = buf[bt - dt];
          buf[bt + 1] = buf[bt + 1 - dt];
          buf[bt + 2] = buf[bt + 2 - dt];
          buf[bt + 3] = buf[bt + 3 - dt];
        }
        bt = end;
      }
    }
    if (lm) final = 1;
  } while (!final)
}

function decompress(text: string, outputSize: number, decodeParam: any): string {
  const t = Date.now();
  const input: Uint8Array = decode(text, decodeParam);
  const output = new Uint8Array(outputSize);
  inflt(input, output);
  const res = new TextDecoder().decode(output);
  console.log(`Decompressed ${text.length} chars to ${res.length} chars in ${Date.now() - t}ms.`);
  return res;
}
