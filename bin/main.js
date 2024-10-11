#!/usr/bin/env node
import { Command } from "commander";
import * as fs from 'fs';
import { Logger } from "tslog";
import recursiveCompression from "./recursiveReplacer.js";
// Configure logging
const logger = new Logger();
logger.settings.name = "compressor";
logger.settings.prettyLogTemplate = "{{name}} {{logLevelName}} ";
logger.settings.prettyLogStyles.name = ["cyan"];
// Version constant.  Remember to update!
const version = "0.1.0";
// Start
await main();
async function main() {
    // Read command line parameters
    const program = new Command();
    program
        .name("selfextractor-compressor")
        .version(version)
        .description("A tool for turning a javascript file into a shorter block of javascript code that unpacks and runs the original code.  Geared towards demoscene use and packing small javascript files targeting a few kilobytes to tens of kilobytes.  Not intended or tested for larger websites or web applications (the compression time grows exponentially with the input size).")
        .requiredOption("-i, --in <file>", "Javascript file to compress")
        .requiredOption("-o, --out <file>", "File to save output to.  Existing content will be overwritten.")
        .parse(process.argv);
    const options = program.opts();
    const inFileName = options["in"];
    const outFileName = options["out"];
    // Read input
    logger.warn("Reading input from " + inFileName);
    const input = fs.readFileSync(inFileName, 'utf8');
    // Compress
    logger.error("Compressing...");
    let compressed = await doCompress(input);
    // Write output
    fs.writeFileSync(outFileName, compressed, { flush: true });
    logger.info("Self-extracting compressed output written to " + outFileName);
}
async function doCompress(source) {
    logger.info("Self-extractor packer optimizing...");
    // DEBUG
    logger.debug("Source before self-extract compression:\n\n" + source + "\n");
    // Check for backticks.  They may cause problems.
    // TODO: Test if backticks cause problems
    if (source.includes("`")) {
        logger.error("The source contains backtick characters `. The self-extractor compresser currently may have trouble with those (specifically, any $references or ${ code blocks } inside them).");
        // Abort
        //return source
    }
    // Get the content of the (last) <script></script> tag
    var extractedSource = source.match(/^.*<script[^>]*>((?:.|\n)*)<\/script>.*$/im)?.map((value) => value)[1];
    // If a script tag is found, use its content, otherwise assume the whole input file is the source
    if (extractedSource != undefined)
        source = extractedSource;
    // Trim leading and trailing whitespace
    source = source.trim();
    // Run through the best compressor
    source = await selectCompression(source, logger);
    // Return optimized result
    return source;
}
export default async function selectCompression(input, logger) {
    // Remove any lines starting with a comment //
    // Source mappings are inserted that way
    input = input.replace(/^\/\/.*$/gm, '');
    // Remove preceeding and trailing whitespace, including newlines
    input = input.trim();
    // Select optimal compressor
    const recursiveReplacerCompressed = await recursiveCompression(input, logger);
    let alternatives = [
        recursiveReplacerCompressed,
        input,
    ];
    alternatives.sort((a, b) => a.length - b.length);
    let compressedCode = alternatives[0];
    // Notify user if we can't compress input
    if (compressedCode === input) {
        logger.warn("Could not reduce the size of the input source using the compressor, " +
            "returning original source. (Compressed code was " + recursiveReplacerCompressed.length +
            " bytes, while original was " + input.length + " bytes.)");
    }
    return compressedCode;
}
//# sourceMappingURL=main.js.map