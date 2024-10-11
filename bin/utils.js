/**
 * Worst case O(n^3), although reduced by min and max substring length
 *
 * @param input input string to analyze
 * @param idLength length of id that the substring would be substituted with (in bytes)
 * @param fixedOverhead fixed overhead for doing the substitution
 * @param minLength minimum length of substrings to test
 * @param maxLength maximum length of substrings to test
 * @param replaceAll if true, returns the best even if it has negative value (increases total length)
 * @param splitEscapes if true, allows splitting escaped character sequences, e.g. \n into \ and n
 * @returns the substring that compresses the result most if replaced, or undefined if no
 *          substring found that would reduce the result size
 */
export function findMostValuableReplacement(inputs, replacement, idLength, storedIdLength, fixedOverhead, minLength = 2, maxLength = 25, replaceAll = false, splitEscapes = false, skipReplacements = []) {
    let foundAnything = false;
    let result = { replacement: '', count: 0, value: replaceAll ? Number.NEGATIVE_INFINITY : 0, replacementOrder: replacement };
    let checked = new Set(skipReplacements);
    // Loop sizes
    for (let substringLength = maxLength; substringLength >= minLength; substringLength--) {
        // Loop inputs
        for (let input of inputs) {
            let inputLen = input.length;
            // Sweep over input, test each substring in the window
            for (let i = 0; i < inputLen - substringLength + 1; i++) {
                let subString = input.substring(i, i + substringLength);
                // Do not re-check substrings, and skip over substrings that cut an escaped special character in two
                if (!checked.has(subString) && (splitEscapes || !subString.endsWith('\\'))) {
                    checked.add(subString);
                    // Count occurences in all input strings
                    let count = occurrencesInStrings(inputs, subString);
                    let value = calculateValue(substringLength, count, idLength, storedIdLength, fixedOverhead);
                    if (value > result.value) {
                        foundAnything = true;
                        result.value = value;
                        result.replacement = subString;
                        result.count = count;
                    }
                }
            }
        }
    }
    return foundAnything ? result : undefined;
}
/**
 * @returns  How many characters a substitution will reduce the result with
 */
export function calculateValue(substringLength, count, idLength, storedIdLength, fixedOverhead) {
    return substringLength * count - substringLength - idLength * count - storedIdLength - fixedOverhead;
}
/**
 * Return a quoted version of the string, with any conflicting quotes escaped.
 */
export function quoteString(s, allowBacktickQuotes = true, allowSingleQuotes = true) {
    // Construct alternative ways to quote string
    let alternatives = [
        '"' + replaceAll(s, '"', '\\"') + '"'
    ];
    if (allowSingleQuotes) {
        alternatives.push("'" + replaceAll(s, "'", "\\'") + "'");
    }
    if (allowBacktickQuotes) {
        alternatives.push('`' + replaceAll(replaceAll(s, "${", "\\${"), '`', '\\`') + '`');
    }
    // Sort by increasing length
    alternatives.sort((a, b) => a.length - b.length);
    // Pick shortest
    return alternatives[0];
}
/**
 * Return a backtick-quoted version of the string, with any conflicting characters escaped.
 */
export function backtickQuoteString(s) {
    // Escape backticks and inline code ${}
    return '`' + replaceAll(replaceAll(s, "${", "\\${"), '`', '\\`') + '`';
}
export function any(list, predicate) {
    for (let e of list) {
        if (predicate(e))
            return true;
    }
    return false;
}
/**
 * Return a quoted version of the html attribute, with any conflicting quotes escaped.
 */
export function quoteHtmlAttribute(s) {
    // Quotes not needed in some cases
    let quotesNeeded = any(" \n'\"`=<>&".split(''), (c) => s.includes(c));
    if (!quotesNeeded)
        return s;
    else {
        // Construct alternative ways to quote string
        // & probably only needs to be quoted if it happens to form a html character
        // TODO: Test if &-based characters are contained (probably &alpha+; pattern or such), if so, quote & to &amp;
        let alternatives = [
            '"' +
                //            s.replace(/&/g, '&amp;')
                s.replace(/"/g, '&quot;') +
                '"',
            "'" +
                //            s.replace(/&/g, '&amp;')
                s.replace(/'/g, '&apos;') +
                "'",
        ];
        // Sort by increasing length
        alternatives.sort((a, b) => a.length - b.length);
        // Pick shortest
        return alternatives[0];
    }
}
export function occurrencesInStrings(strings, subString, allowOverlapping = false) {
    let n = 0;
    for (let s of strings)
        n += occurrences(s, subString, allowOverlapping);
    return n;
}
/**
 * Function that count occurrences of a substring in a string;
 * @param {String} string               The string
 * @param {String} subString            The sub string to search for
 * @param {Boolean} [allowOverlapping]  Optional. (Default:false)
 *
 * @author Vitim.us https://gist.github.com/victornpb/7736865
 * @see Unit Test https://jsfiddle.net/Victornpb/5axuh96u/
 * @see https://stackoverflow.com/a/7924240/938822
 */
export function occurrences(string, subString, allowOverlapping = false) {
    string += "";
    subString += "";
    if (subString.length <= 0)
        return (string.length + 1);
    let n = 0, pos = 0, step = allowOverlapping ? 1 : subString.length;
    while (true) {
        pos = string.indexOf(subString, pos);
        if (pos >= 0) {
            ++n;
            pos += step;
        }
        else
            break;
    }
    return n;
}
export function replaceAll(s, from, to) {
    return s.split(from).join(to);
}
export function mix(t, a, b) {
    return t * (b - a) + a;
}
export function findUnusedCharacters(s, forbiddenCharacters = "") {
    // Find possible escape characters (unused printable ascii characters)
    const alwaysForbidden = "\\\`'\"";
    let substitutionCharacters = [];
    for (let i = 32; i < 127; ++i) {
        let char = String.fromCharCode(i);
        if (!s.includes(char) && !alwaysForbidden.includes(char) && !forbiddenCharacters.includes(char)) {
            substitutionCharacters.push(char);
        }
    }
    // Fallback if there are too few characters, test some characters outside printable ascii range
    const fallbackEscapeCharacters = "\x1D\x1E\x1F\x01\x02\x03\x04\x05\x06\x07\x10\x11\x12\x13\x14\x1A";
    if (substitutionCharacters.length <= 4) {
        for (let c of fallbackEscapeCharacters) {
            if (!s.includes(c))
                substitutionCharacters.push(c);
        }
    }
    // Prefer | for primary separator character
    const preferred = "|";
    if (substitutionCharacters.includes(preferred)) {
        // Move to front
        substitutionCharacters = [preferred].concat(substitutionCharacters.filter((s) => s != preferred));
    }
    return substitutionCharacters;
}
export const BASE85_START = 37; // First base85 digit is '%' and last 'y'.  '"' is not included, and can be used for quoting.
export function binaryToBase85(binaryBlob) {
    // Sanity check 
    if ((binaryBlob.length % 32) != 0)
        throw new Error("Internal error in self-extraction compressor, the binary blob length for base 85 encoding was not a multiple of 32 bits (it was " + binaryBlob.length + " bits)");
    // Convert to base85
    let base85 = '';
    for (let i = 0; i < binaryBlob.length; i += 32) {
        let binary = binaryBlob.slice(i, i + 32);
        let data = parseInt(binary, 2);
        for (let j = 0; j < 5; j++) {
            base85 += String.fromCodePoint(BASE85_START + data % 85);
            data = Math.floor(data / 85);
        }
    }
    return base85;
}
/**
 * Applies a mapping function to the entries in a map
 */
export function mapMap(map, func) {
    let result = [];
    for (let e of map.entries()) {
        result.push(func(e[0], e[1]));
    }
    return result;
}
/**
 * Split the string to chunks of the specified length.
 * The last chunk may be shorter.
 * Optionally pad the last line if it is shorter than length using the specified padding.
 * @param s
 * @param length
 * @param padding character to pad with, or undefined for no padding.
 */
export function splitToLength(s, length, padding = undefined) {
    return s.match(new RegExp("(.{1," + length + "})", "g")).map((line) => padding != undefined ? line.padStart(length, padding) : line);
}
export function bufferToHex(buffer, bytesPerRow = undefined, bytePrefix = '  ', includeChar = true) {
    let prefix = bytePrefix != undefined ? bytePrefix : '';
    let entryLength = 2 + bytePrefix.length + (includeChar ? 2 : 0);
    // Format
    let hexSoup = [...buffer].map((x) => {
        let char = includeChar ? (x >= 32 && x < 127 ? (" " + String.fromCodePoint(x)) : "  ") : '';
        return prefix + x.toString(16).padStart(2, '0') + char;
    }).join('');
    // Split to lines if requested
    if (bytesPerRow != undefined && bytesPerRow > 0) {
        hexSoup = splitToLength(hexSoup, bytesPerRow * entryLength).join('\n');
    }
    return hexSoup;
}
/**
 * Simple class for building binary data and returning it as a buffer.
 *
 * Methods can be chained.
 * Use toBuffer() to build a buffer and return it.
 * Use clear() to clean the BufferBuilder
 *
 * Not necessarily efficient.
 */
export class BufferBuilder {
    parts = [];
    /**
     * Empties this builder.
     */
    clear() {
        this.parts = [];
    }
    /**
     * @returns the created buffer.
     * The BufferBuilder is not altered.
     */
    build() {
        return Buffer.concat(this.parts);
    }
    /**
     * @returns a copy of this buffer builder
     */
    copy() {
        let other = new BufferBuilder();
        other.parts = this.parts.slice();
        return other;
    }
    string(s) {
        let b = Buffer.from(s);
        this.parts.push(b);
        return this;
    }
    buffer(b) {
        this.parts.push(b);
        return this;
    }
    /**
     * Add the current conents of the specified buffer builder to this buffer.
     * @returns this buffer builder for chaining.
     */
    builder(b) {
        return this.buffer(b.build());
    }
    uInt32BE(i) {
        return this.int(i, 4, false, true);
    }
    uInt32LE(i) {
        return this.int(i, 4, false, false);
    }
    uInt16BE(i) {
        return this.int(i, 2, false, true);
    }
    uInt16LE(i) {
        return this.int(i, 2, false, false);
    }
    uInt8(i) {
        return this.int(i, 1, false, true);
    }
    int(i, numberSizeBytes, signed, bigEndian) {
        let data = (typeof (i) == "number") ? [i] : i;
        if (data.length <= 0)
            return this;
        // Create buffer, and store it
        let b = Buffer.alloc(data.length * numberSizeBytes);
        this.parts.push(b);
        // Write number(s) in correct format
        for (let j = 0; j < data.length; j++) {
            let offset = j * numberSizeBytes;
            let num = data[j];
            if (!signed && bigEndian) {
                b.writeUIntBE(num, offset, numberSizeBytes);
            }
            else if (!signed && !bigEndian) {
                b.writeUIntLE(num, offset, numberSizeBytes);
            }
            else if (signed && bigEndian) {
                b.writeIntBE(num, offset, numberSizeBytes);
            }
            else if (signed && !bigEndian) {
                b.writeIntLE(num, offset, numberSizeBytes);
            }
        }
        // Return self for chaining
        return this;
    }
    addWithFun(size, initializer) {
        // Create buffer, and store it
        let b = Buffer.alloc(size);
        this.parts.push(b);
        // Use intializer to set its value
        if (initializer)
            initializer(b);
        // For chaining
        return this;
    }
}
/**
 * Convenience method that returns a new buffer builder instance.
 */
export function buildBuffer() {
    return new BufferBuilder();
}
export function shallowCopyObj(obj) {
    return Object.assign({}, obj);
}
export function doubleEscape(s) {
    // Double escape any escaped characters, as one level of escapement is stripped away during the evaluation process at some point
    return replaceAll(s, "\\", "\\\\");
}
//# sourceMappingURL=utils.js.map