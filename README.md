# Simple and fast text compression

It it primarily designed to compress text inside a big HTML files.

The tool uses three compression methods:
 * **str2str** - Custom made, simple, small and fast decompression. It is able to compress between string and string - no binary representation is needed, so there is no need to encode it e.g. in base64 encoding.
 * **deflate**
 * **bzip2**

The *bzip2* and *deflate* requires additional binary to text encoding wich can be:
 * **base64** - standard base-64 encoding with **4/3** ratio.
 * **base85** - it is a variant of base-85 encoding customized for simpler JS decoder implementation. It has **5/4** ratio.
 
Methods from fastest to slowest: str2str, deflate-base64, deflate-base85, bzip2-base64, bzip2-base85

Methods from highest compression to the lowest: bzip2-base85, bzip2-base64, deflate-base85, deflate-base64, str2str

*(results may varry depending on browser and compressed content)*
 
## Building

First upate modules:
```
npm update
```

Next, build the minified JS files:
```
npm run build
```

## html-compress.py

Tool that finds long `<script>` and `<style>` tags and replaces them with a JavaScript containing compressed representation of it contents.
It also embeds minified decompressor source code in the HTML.

You can specify the compression method with the `-m` parameter, e.g.:
```
python html-compress.py -m deflate-base85 -o compressed-output.html input.html
```
