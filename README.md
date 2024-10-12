# Selfextractor Compressor for Javascript

A tool for turning a javascript file into a shorter block of javascript code that unpacks
and runs the original code.  

Geared towards demoscene use or packing small javascript files targeting a few kilobytes.

Not intended or tested for larger websites or web applications.

Packing works by recursively replacing repeated pieces of text with a shorter key.  The replacement 
operates on both the packed text as well as the list of earlier replacements.  The unpacker is a relatively 
compact piece of code (about 136 characters, not counting the character array of used key characters) attached 
to the compressed result that recursively unwinds the packing (replacing keys in the packed text and
replacement strings with replacements, going in reverse order), and finally calls `eval` with the unpacked code.

## Limitations

The packer requires that at least a few ASCII characters are not used anywhere in the original code
(they will be used for separators, keys, and key prefixes in the packed format).

Backticks containing variable placements inside (e.g. \`foo $variablename bar\`) are unfortunately not 
currently supported, they will interfere with the way the source is packed.  The tool will issue a
warning if it finds them, and return the source unmodified.

Note that this tool does not do any structural minifying.  It is recommended to run the code through
google-closure-compiler or a similar minifier first.  The selfextractor-compressor is good at compressing
repeating sections in already minified code, such as repeating system function calls, "return ":s, 
"this."-instnaces, and so on.  This packer also works fairly well on shader code that often has a lot 
of repeating "vec3 ":s, "float ":s and similar.

The packing time increases exponentially with input source size, so this packer is not well suited for very 
large applications or websites.  Emphazis has been put on compressing 2-20kb source files as compactly as 
possible.

Very small source files do not benefit from this compression system, as it adds overhead in the form of the 
unpacking code.  If the compressed size would be larger than the input size, the compressor returns the input 
code unchanged and issues a notification to the console about that.

With the advent of webassembly and the compression streams web API it is likely possible to create more 
compact packing using either of those, so this is probably not the most optimal way to pack javascript, 
but it does tend to shrink traditionally minified code somewhat.

## Installation

    npm i selfextractor-compressor

## Usage

    selfextractor-compressor  --in input.js  --out compressed-output.js

    Options:
    -i, --in <file>   Javascript file to compress.
    -o, --out <file>  File to save output to.  Existing content will be overwritten.
    -V, --version     Output the version number.
    -h, --help        Display help for command.


## Example compile script utilizing the selfextractor

    #! /bin/bash
    
    # Uses google closure compiler and selfextractor-compressor
    # First make sure you have npm installed,
    # then install the closure compiler with  npm i google-closure-compiler
    # and the selfextractor compressor with   npm i selfextractor-compressor
    
    # Minify structurally
    google-closure-compiler -O ADVANCED script.js --js_output_file script.minified.js &&

    # Compress and eliminate repetitions
    selfextractor-compressor -i script.minified.js -o script.minified-compressed.js &&
    
    # Compose to stand-alone html page
    # (prefix and postfix files should contain html to add before and after the script).
    cat prefix.html script.minified-compressed.js postfix.html > index.html &&
    
    # Show size of final entry
    filesize=$(ls -l index.html | awk '{print  $5}')
    echo -e "Filesize: $filesize bytes"
  

## License

MIT License


## Similar or other useful tools

### Google Closure Compiler

A good minifier.
https://github.com/google/closure-compiler


### Compression Streams API

Needs a binary blob delivered to it, but supports e.g. gzip packing.
So would need an efficient data encoding, code for unpacking it,
code for running it through the compression streams, and an eval of the result.
Might be some overhead for under 1k cases, but likely more efficient for larger cases.
https://developer.mozilla.org/en-US/docs/Web/API/Compression_Streams_API


### Crunchme

Crunchme operates on a similar principle as selfextractor-compressor.
It packs the javascript source using LZG and DEFLATE and bundles a small 
decompressor to uncompress and run the compressed code.  However, it 
targets slightly larger file sizes, such as 64k demos.

https://crunchme.bitsnbites.eu/

https://www.bitsnbites.eu/compression-of-javascript-programs/


### Others

- jsExe: http://creativejs.com/2012/06/jsexe-javascript-compressor/
- javascript packify: https://github.com/cowboy/javascript-packify
- jsCrush: http://iteral.com/jscrush/
- See also analysis at: https://timepedia.blogspot.com/2009/08/on-reducing-size-of-compressed.html


## Feedback

Report any issues and feature requests on the github issue tracker.

Pull requests for improvements are generally welcomed.

----

Thanks for taking the time to look into this project!

If you find it useful, or use it in some production, feel free to drop me a note and I'll add a link.
If you find some other project that complements or deprecates this one, please let me know so I can add a link.
