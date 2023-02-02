
const base85Inv = (() => {
    const base85Alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~';
    const result = new Uint8Array(128);
    for (let i = 0; i < base85Alphabet.length; i++) {
        result[base85Alphabet.charCodeAt(i)] = i;
    }
    return result;
})();

function decode(text: string): Uint8Array {
    const input = new TextEncoder().encode(text);
    const inputLength = input.length;
    let inputPos = 0;
    const output = new Uint8Array(4 + Math.ceil(inputLength * 4 / 5));
    let outputPos = 0;
    while (inputPos < inputLength - 5) {
        let value = base85Inv[input[inputPos]]
            + base85Inv[input[inputPos + 1]] * 85
            + base85Inv[input[inputPos + 2]] * 7225
            + base85Inv[input[inputPos + 3]] * 614125
            + base85Inv[input[inputPos + 4]] * 52200625;
        inputPos += 5;
        output[outputPos++] = value & 0xFF;
        output[outputPos++] = (value >> 8) & 0xFF;
        output[outputPos++] = (value >> 16) & 0xFF;
        output[outputPos++] = (value >> 24) & 0xFF;
    }
    if (inputPos < inputLength) {
        let value = base85Inv[input[inputPos]]
            + (base85Inv[input[inputPos + 1]] || 0) * 85
            + (base85Inv[input[inputPos + 2]] || 0) * 7225
            + (base85Inv[input[inputPos + 3]] || 0) * 614125
            + (base85Inv[input[inputPos + 4]] || 0) * 52200625;
        output[outputPos++] = value & 0xFF;
        output[outputPos++] = (value >> 8) & 0xFF;
        output[outputPos++] = (value >> 16) & 0xFF;
        output[outputPos++] = (value >> 24) & 0xFF;
    }
    return output.subarray(0, outputPos - (inputPos + 5 - inputLength));
}
