

import base64
import zlib

def bytesToBase85(data):
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

cmp = zlib.compressobj(level=9, wbits=-15, memLevel=9)
compressed = cmp.compress('ółźąAll pending input is processed, and a bytes object containing the remaining compressed output is returned. mode can be selected from the constants Z_NO_FLUSH, Z_PARTIAL_FLUSH, Z_SYNC_FLUSH, Z_FULL_FLUSH, Z_BLOCK (zlib 1.2.3.4), or Z_FINISH, defaulting to Z_FINISH. Except Z_FINISH, all constants allow compressing further bytestrings of data, while Z_FINISH finishes the compressed stream and prevents compressing any more data. After calling flush() with mode set to Z_FINISH, the compress() method cannot be called again; the only realistic action is to delete the object.'.encode('utf-8'))
compressed += cmp.flush()
encoded = bytesToBase85(compressed)

print(encoded)
