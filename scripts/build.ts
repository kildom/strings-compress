
import * as fs from 'fs';
import { spawnSync } from 'child_process';

const variants = [
    ['str2str', 'none'],
    ['deflate', 'base64'],
    ['deflate', 'base85'],
    ['bzip2', 'base64'],
    ['bzip2', 'base85'],
];


function compile(decompressor: string, decoder: string) {
    let template = fs.readFileSync('src/template.ts', 'utf-8');
    let decompress = fs.readFileSync(`src/decompress-${decompressor}.ts`, 'utf-8');
    let decode = fs.readFileSync(`src/decode-${decoder}.ts`, 'utf-8');
    let source = template.replace('/**/', decode + decompress);
    let ts = `build/decompress-${decompressor}-${decoder}.ts`;
    let js = `dist/decompress-${decompressor}-${decoder}.min.js`;
    fs.writeFileSync(ts, source);
    spawnSync('npx', ['esbuild', ts, '--minify', `--outfile=${js}`], { stdio: 'inherit' });
}


for (let [decompressor, decoder] of variants) {
    compile(decompressor, decoder);
}
