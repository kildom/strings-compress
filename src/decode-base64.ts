
function decode(text: string): Uint8Array {
    let binStr = atob(text);
    let result = new Uint8Array(binStr.length);
    for (let i = 0; i < result.length; i++) {
        result[i] = binStr.charCodeAt(i);
    }
    return result;
}
