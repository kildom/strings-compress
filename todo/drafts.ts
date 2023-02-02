

function uint8ArrayToBase64(data: Uint8Array): string {
    let dataUTF8 = new Uint8Array(2 * data.length);
    let dataUTF8Length = 0;
    for (let i = 0; i < data.length; i++) {
        let v = data[i];
        if (v < 128) {
            dataUTF8[dataUTF8Length++] = v;
        } else {
            dataUTF8[dataUTF8Length] = (v >> 6) | 0xC0;
            dataUTF8[dataUTF8Length + 1] = (v & 0x3F) | 0x80;
            dataUTF8Length += 2;
        }
    }
    let binStr = new TextDecoder().decode(dataUTF8.subarray(0, dataUTF8Length));
    return btoa(binStr);
}


const base85Alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~';
const base85Tab = new Uint8Array(base85Alphabet.length);
for (let i = 0; i < base85Tab.length; i++) {
    base85Tab[i] = base85Alphabet.charCodeAt(i);
}


function uint8ArrayToBase85(data: Uint8Array): string {
    const dataLength = data.length;
    let dataPos = 0;
    const output = new Uint8Array(5 + Math.ceil(dataLength * 5 / 4));
    let outputPos = 0;
    while (dataPos < dataLength) {
        let value;
        let first = (data[dataPos + 3] & 0xFF);
        if (first < 128) { // In Firefox, avoiding integers > 2^31-1 causes significant performance boost (tested with v109).
            value = first << 24 | data[dataPos + 2] << 16 | data[dataPos + 1] << 8 | data[dataPos];
            output[outputPos++] = base85Tab[value % 85];
            value = (value / 85) >> 0;
        } else if (first < 213) {
            value = (first - 85) << 24 | data[dataPos + 2] << 16 | data[dataPos + 1] << 8 | data[dataPos];
            output[outputPos++] = base85Tab[value % 85];
            value = ((value / 85) >> 0) + 0x1000000;
        } else {
            value = (first - 170) << 24 | data[dataPos + 2] << 16 | data[dataPos + 1] << 8 | data[dataPos];
            output[outputPos++] = base85Tab[value % 85];
            value = ((value / 85) >> 0) + 0x2000000;
        }
        output[outputPos++] = base85Tab[value % 85];
        value = (value / 85) >> 0;
        output[outputPos++] = base85Tab[value % 85];
        value = (value / 85) >> 0;
        output[outputPos++] = base85Tab[value % 85];
        value = (value / 85) >> 0;
        output[outputPos++] = base85Tab[value];
        dataPos += 4;
    }
    return new TextDecoder().decode(output.subarray(0, outputPos - (dataPos - dataLength)));
}
