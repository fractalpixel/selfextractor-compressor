

- Rename to origami-compressor?
- Switch to using UTF8 for better compression?  Include a byte order mark at the start to indicate the file is UTF16.  Decompresser needs to be in UTF16 too, so about double space - except if packed, see https://www.bitsnbites.eu/compression-of-javascript-programs/ .
- We can also utilize PNG unpacking code (not the executable PNG hack)
- 