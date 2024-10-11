# Javascript Selfextractor Compressor

A tool for turning a javascript file into a shorter block of javascript code that unpacks and runs the original code.  

Geared towards demoscene use and packing small javascript files targeting a few kilobytes.

Not intended or tested for larger websites or web applications.

Packing works by recursively replacing repeated pieces of text with a shorter id.  The unpacker is a relatively compact piece of code that recursively unwinds the packing, and finally calls `eval` with the unpacked code.

## Limitations

The packer requires that at least a few ASCII characters are not used anywhere in the original code (they will be used for separators, id prefixes, and such in the packed format).

Backticks containing variable placements inside (e.g. \`foo $variablename bar\`) are unfortunately not currently supported, they will interfere with the way the source is packed.  The tool will issue a warning if it finds them, and return the source unmodified.

Note that this tool does not do any structural minifying.  It is recommended to run the code through google-closure-compiler or a similar minifier first.  The selfextractor-compressor is good at compressing repeating sections in already minified code, such as repeating system function calls, "return ":s, "this."-instnaces, and so on.  This packer also works fairly well on shader code that often has a lot of repeating "vec3 ":s, "float ":s and similar.

The packing time increases exponentially with input source size, so this packer is not well suited for very large applications or websites.  Emphazis has been put on compressing 2-20kb source files as compactly as possible.

Very small source files do not benefit from this compression system, as it adds overhead in the form of the unpacking code.  If the compressed size would be larger than the input size, the compressor returns the input code unchanged and issues a notification to the console about that.

With the advent of webassembly, it is probably possible to create more compact packing using some technology based on that, so this is probably not the most optimal way to pack javascript, but it does tend to shrink traditionally minified code somewhat.

## Installation

    npm i selfextractor-compressor

## Usage

    selfextractor-compressor input.js compressed-output.js


## Example compile script utilizing the selfextractor

    #! /bin/bash
    
    # Uses google closure compiler and selfextractor-compressor
    # First make sure you have npm installed,
    # then install the closure compiler with  npm i google-closure-compiler
    # and the selfextractor compressor with   npm i selfextractor-compressor
    
    # Minify structurally
    google-closure-compiler -O ADVANCED script.js --js_output_file script.minified.js &&

    # Compress and eliminate repetitions
    selfextractor-compressor script.minified.js script.minified-compressed.js &&
    
    # Compose to executable html page
    cat prefix.html script.minified-compressed.js postfix.html > index.html &&
    
    # Show size of final entry
    filesize=$(ls -l index.html | awk '{print  $5}')
    echo -e "Filesize: $filesize bytes"
  

## License

Apache v. 2.0


## Feedback

Report any issues and feature requests on the github issue tracker.

Pull requests for improvements are generally welcomed.

----

Thanks for taking the time to look into this project!

If you find it useful, or use it in some production, feel free to drop me a note and I'll add a link.
If you find some other project that complements or deprecates this one, please let me know so I can add a link.
