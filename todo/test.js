

const fs = require('fs');

let str = fs.readFileSync('../dist/decompress-deflate-base85.min.js', 'utf-8');
//let str = fs.readFileSync('/home/doki/work/ncs/sizegraph/web-build/build/index.html', 'utf-8');

const alf = new TextDecoder().decode(new Uint8Array(95).map((x, i) => 32 + i)).replace('\'', '').replace('/', '').replace('\\', '');
const nextValues = 24;

let output = '';
let esc = '@#%^';

let nl = 1;

let i = 0;
main_loop:
while (i < str.length - esc.length - 4) {
    if (i % 100 == 0) console.log(`${i / 1024} of ${str.length / 1024}`);
    for (let count = 3 + esc.length; count > 2; count--) {
        if (i - count < 0) continue;
        let sub = str.substring(i, i + count);
        let index;
        if (i > 4000) {
            index = str.substring(i - 4000).lastIndexOf(sub, i - count);
            if (index >= 0) index += i - count;
        } else {
            index = str.lastIndexOf(sub, i - count);
        }
        let offset = i - count - index;
        if (index >= 0 && offset < alf.length - nextValues && count < 3 + esc.length) {
            output += esc[count - 3];
            output += alf[offset];
            i += count;
            continue main_loop;
        }
        if (index >= 0 && offset < alf.length - nextValues + nextValues * alf.length && offset >= alf.length - nextValues && count > 3) {
            offset -= alf.length - nextValues;
            output += esc[count - 4];
            output += alf[Math.floor(offset / alf.length) + alf.length - nextValues];
            output += alf[offset % alf.length];
            i += count;
            continue main_loop;
        }
    }
    output += str[i];
    i++;
}

output += str.substring(i);


//console.log(output);
console.log(output.length);
console.log(str.length);

function decomp(input) {
    let esc = '@#%^';
    let charValue = pos => {
        let c = input.charCodeAt(pos);
        return c - (c < 40 ? 0 : c < 48 ? 1 : c < 93 ? 2 : 3) - 32;
    }
    let dec = '';
    i = 0;
    while (i < input.length) {
        let c = input[i++];
        let count = esc.indexOf(c) + 3;
        if (count >= 3) {
            let offset = charValue(i++);
            if (offset >= 68) {
                count++;
                offset = offset * 92 + charValue(i++) - 6188;
            }
            dec += dec.substring(dec.length - offset - count, dec.length - offset);
        } else {
            dec += c;
        }
    }
    return dec;
}
//function decomp(e){let t=t=>{let n=e.charCodeAt(t);return n-(n<40?0:n<48?1:n<93?2:3)-32},n="";for(i=0;i<e.length;){let l=e[i++],r="@#%^".indexOf(l)+3;if(r>=3){let f=t(i++);f>=68&&(r++,f=92*f+t(i++)-6188),n+=n.substring(n.length-f-r,n.length-f)}else n+=l}return n}

let dec = decomp(output);

//console.log(dec);
console.log(dec.length);
console.log(dec == str);
console.log(Math.round((output.length + 265) / dec.length * 1000) / 10);

/*
let map = new Array(92).fill().map(() => new Array(4).fill(0));

for (let i = 2; i < 6; i++) {
    //console.log(`Length ${i}`);
    for (let j = 0; j < str.length - i; j++) {
        let first = str.substring(0, j + i - 1);
        let sub = str.substring(j, j + i);
        let parts = first.split(sub);
        if (parts.length == 0) continue;
        let offset = parts.at(-1).length;
        if (offset < 90) {
            map[offset][i - 2]++;
        }
    }
}

console.log(map);*/


/*
let buf = new Uint8Array(fs.readFileSync('dist/decompress-deflate-base85.min.js'));
let map = new Uint8Array(128);
for (let i = 0; i < buf.length; i++) {
    map[buf[i]]++;
}
console.log(map.subarray(32));
console.log(map.subarray(32).reduce((p, x) => p + (x == 0 ? 1 : 0), 0));
*/
