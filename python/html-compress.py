
import argparse
import base64
import json
import re
import sys
from pathlib import Path
import subprocess
import tempfile
import zlib

parser = argparse.ArgumentParser()

parser.add_argument('filename')
parser.add_argument('-o', '--out', default=None)
parser.add_argument('-m', '--method', default='str2str')

args = parser.parse_args()

def fix_method_name():
    m = args.method.split('-')
    if len(m) < 2:
        m.append('none')
    args.method = '-'.join(m)

fix_method_name()

with open(args.filename, 'r', encoding='utf-8') as fd:
    html = fd.read()

tags_re = re.compile(r'(<style(?:\s+.*?)?>.+?</style>)|(<script(?:\s+.*?)?>)(.+?)(</script>)', flags=re.IGNORECASE|re.DOTALL)

match_count = 0

class MethodParams:
    def __init__(self):
        self.decode = None
        self.decompress = None

def get_code(add_tags: bool) -> str:
    global match_count
    match_count += 1
    if match_count > 1:
        return ''
    script_dir = Path(__file__).parent
    name = 'decompress-' + args.method + '.min.js'
    try_paths = [
        f'{name}',
        f'../{name}',
        f'../dist/{name}',
    ]
    file: 'Path|None' = None
    for path in try_paths:
        if (script_dir / path).exists():
            file = script_dir / path
            break
    else:
        raise Exception(f'Could not find "{name}"')
    result = file.read_text()
    if add_tags:
        result = f'<script>{result}</script>'
    return result

def compress_str2str(string: str, params: MethodParams) -> str:
    input_file = tempfile.NamedTemporaryFile('w', delete=False)
    output_file = tempfile.NamedTemporaryFile('w', delete=False)
    input_name = input_file.name
    output_name = output_file.name
    output_file.close()
    input_file.write(string)
    input_file.close()
    subprocess.run([
        sys.executable,
        str(Path(__file__).parent / 'strings-compress.py'),
        '-a', 'js-single-quote',
        '-o', output_name,
        input_name], check=True)
    result = Path(output_name).read_text()
    Path(input_name).unlink()
    Path(output_name).unlink()
    if len(result.strip()) < 16:
        raise Exception('Could not execute "strings-compress.py" or execution failed.')
    return result

def compress_bzip2(string: str, params: MethodParams) -> bytes:
    plain = string.encode('utf-8')
    params.decompress = len(plain)
    input_file = tempfile.NamedTemporaryFile('wb', delete=False)
    input_name = input_file.name
    output_name = input_name + '.bz2'
    input_file.write(plain)
    input_file.close()
    subprocess.run([
        'bzip2',
        input_name], check=True)
    result = Path(output_name).read_bytes()
    Path(output_name).unlink()
    if len(result) < 1:
        raise Exception('Could not execute "bzip2" or execution failed.')
    return result

def compress_deflate(string: str, params: MethodParams) -> bytes:
    obj = zlib.compressobj(level=9, wbits=-15, memLevel=9)
    plain = string.encode('utf-8')
    params.decompress = len(plain)
    compressed = obj.compress(plain)
    compressed += obj.flush()
    return compressed


def encode_base85(data, params):
    '''
    Custom base-85 encoding. It differs from standard git-style (RFC 1924) encoding. Input bytes
    and output characters in groups are reordered. This allows simpler JavaScript implementation
    of decoder.
    '''
    missing = ((len(data) + 3) // 4) * 4 - len(data)
    aligned = data + b'\0' * missing
    parts = (aligned[i + 3:(i - 1 if i else None):-1] for i in range(0, len(aligned), 4))
    encoded = base64.b85encode(b''.join(parts))
    parts = (encoded[i + 4:(i - 1 if i else None):-1] for i in range(0, len(encoded), 5))
    output = b''.join(parts)
    return output[0:len(output) - missing].decode('8859')

def encode_base64(data, params):
    return base64.b64encode(data).decode('8859')

def encode_none(data, params):
    return data

def compress_string(string: str) -> str:
    m = args.method.split('-')
    compress = globals()['compress_' + m[0]]
    encode = globals()['encode_' + m[1]]
    params = MethodParams()
    cmp = compress(string, params)
    result = encode(cmp, params)
    decompress_params = ',' + json.dumps(params.decompress) if params.decompress is not None else (
        ',0' if params.decode is not None else ''
    )
    decode_params = ',' + json.dumps(params.decode) if params.decode is not None else ''
    return f'decompressString(\'{result}\'{decompress_params}{decode_params})'

def compress_style(text: str) -> str:
    if len(text.strip()) < 256:
        print('Skipping style compression - content too short.')
        return text
    print('Found long style tag - compressing...')
    compressed = compress_string(text)
    if len(compressed) + 53 > len(text):
        print('Skipping style compression - content uncompressible.')
        return text
    return f'<script>{get_code(False)}document.write({compressed})</script>'

def compress_script(open_tag: str, source_code: str, close_tag: str) -> str:
    if len(source_code.strip()) < 256:
        print('Skipping script compression - content too short.')
        return f'{open_tag}{source_code}{close_tag}'
    print('Found long script - compressing...')
    compressed = compress_string(source_code)
    if len(compressed) + 27 > len(source_code):
        print('Skipping script compression - content uncompressible.')
        return f'{open_tag}{source_code}{close_tag}'
    return f'{get_code(True)}{open_tag}eval({compressed}){close_tag}'

def compress_tags(match: re.Match) -> str:
    if match.group(1):
        return compress_style(match.group(1))
    else:
        return compress_script(match.group(2), match.group(3), match.group(4))

out = tags_re.sub(compress_tags, html)

if args.out is None:
    print(out)
else:
    print(f'Compression done.')
    print(f'Size before: {len(html)}')
    print(f'Size after:  {len(out)}')
    print(f'Ratio:       {round(len(out) / len(html) * 1000) / 10}%')
    with open(args.out, 'w', encoding='utf-8') as fd:
        fd.write(out)
