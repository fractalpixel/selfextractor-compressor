import * as utils from "./utils.js";
import Random from "random-seed";
// Raising this slows the replacer, while there are usually few long repeated strings (although they could exist)
const MaxReplacedStringLength = 20;
export const DEFAULT_CONFIG = {
    rounds: 50, // 100
    parameterVariation: 0.4,
    topReplacementsToSelectFrom: 3,
    selectionFocus: 0.7,
    fractionOfSingleCharacterKeys: 0.64,
    useAlphanumericMultiCharacterKeys: true,
    randomSeed: "SelfextractorSeed",
    verbose: true,
};
export default async function compress(source, logger, config = DEFAULT_CONFIG) {
    logger.info("Attempting Recursice Replacer compression");
    if (config.verbose) {
        logger.debug("Selfextractor: Recursive Replacer trying out different replacements on " + source.length + " byte source");
        //console.group()
    }
    let rand = Random.create(config.randomSeed);
    // Sanitize input string, replace newlines with spaces.
    // Should work except if it contains backticks (which we do not support).
    source = utils.replaceAll(source, "\n", " ");
    let alternativeResults = [{ config: config, result: source }];
    function getNthFractionBestResult(n = 0) {
        // Sort results by result length
        alternativeResults.sort((a, b) => a.result.length - b.result.length);
        // Return n:th fractional result
        return alternativeResults[Math.floor(n * alternativeResults.length)];
    }
    function stats(result) {
        return result.length + " B " +
            "(-" + (source.length - result.length) + " B, " +
            (100 * (source.length - result.length) / source.length).toPrecision(3) + "%)";
    }
    // If we don't have any parameter variation or multiple replacements to select from, there is no point in running many rounds.
    config.rounds = config.parameterVariation <= 0 && config.topReplacementsToSelectFrom <= 1 ? 1 : config.rounds;
    let originalVariation = config.parameterVariation;
    let shortestSoFar = source.length;
    let bestStats = '';
    for (let round = 1; round <= config.rounds; round++) {
        // Annealing parameter that approaches 0 over the run, 0 means pick most optimal settings, 1 means pick more exploratory settings
        let annealing = 1 - round / config.rounds;
        annealing = (annealing * annealing + annealing) / 2; // Make annealing approach 0 a bit faster.
        // Pick a good result to improve on, pick only the best towards the end
        let configFocus = annealing * rand.random() * rand.random();
        let baseConfig = utils.shallowCopyObj(getNthFractionBestResult(configFocus).config);
        // Tune parameter variation, less tuning towards end
        baseConfig.parameterVariation = annealing * originalVariation;
        // Adjust values randomly for the parameters
        let roundConfig = tuneConfig(baseConfig, round, rand);
        roundConfig.randomSeed = config.randomSeed + " R" + round;
        // Calculate result using config
        let result = await encode(source, roundConfig, round, logger);
        // Store result
        alternativeResults.push({ config: roundConfig, result: result });
        // It's a long process, so entertain the user
        let improved = false;
        if (result.length < shortestSoFar) {
            shortestSoFar = result.length;
            bestStats = stats(result);
            improved = true;
        }
        if (config.verbose) {
            let params = `seed: "${roundConfig.randomSeed}", selFocus: ${roundConfig.selectionFocus.toPrecision(3)}, singCharKeys: ${roundConfig.fractionOfSingleCharacterKeys.toPrecision(3)}, replacements: ${roundConfig.topReplacementsToSelectFrom}, ${roundConfig.useAlphanumericMultiCharacterKeys ? "alphaNum" : "num"} keys`;
            let improvementIcon = improved ? "+" : (result.length == shortestSoFar ? "=" : "-");
            const alwaysPrintParams = false;
            const printParamsOnImprovement = false;
            logger.info(`Round ${round.toString().padStart(config.rounds.toString().length)} / ${config.rounds} (${Math.round(100 * round / config.rounds).toString().padStart(3)}%): ${improvementIcon} ${stats(result)}. Best is ${bestStats}.` +
                ((alwaysPrintParams || (improved && printParamsOnImprovement)) ? `\nParams: ${params}.` : ""));
        }
    }
    // Determine best result
    let best = getNthFractionBestResult(0);
    let result = best.result;
    if (result.length >= source.length) {
        result = source;
        if (config.verbose)
            logger.debug("Could not find an efficient compression, returning original source");
    }
    else {
        if (config.verbose) {
            logger.debug("Result size is " + stats(result) + ".  Configuration of best result is:");
            logger.debug(JSON.stringify(best.config));
        }
    }
    //if (config.verbose) console.groupEnd()     
    return result;
}
function tuneConfig(config, round, rand) {
    function randomValue(base, min = 0, max = 1) {
        let randomValue = rand.floatBetween(min, max);
        // Mix between the random value and the given parameter, skewing towards the base value
        let randomness = rand.random() < config.parameterVariation ? rand.random() : config.parameterVariation * rand.random();
        return utils.mix(randomness, base, randomValue);
    }
    function randomBoolean(base) {
        let randomValue = rand.random() < 0.5;
        // Mix between the random value and the given parameter, skewing towards the base value
        return (1 - rand.random() * rand.random()) < config.parameterVariation ? randomValue : base;
    }
    // Select values randomly for the parameters
    let roundConfig = {
        rounds: config.rounds,
        parameterVariation: config.parameterVariation,
        verbose: config.verbose,
        randomSeed: config.randomSeed + " R" + round,
        selectionFocus: randomValue(config.selectionFocus),
        fractionOfSingleCharacterKeys: randomValue(config.fractionOfSingleCharacterKeys),
        useAlphanumericMultiCharacterKeys: randomBoolean(config.useAlphanumericMultiCharacterKeys),
        topReplacementsToSelectFrom: Math.round(randomValue(config.topReplacementsToSelectFrom, 1, 30)),
    };
    return roundConfig;
}
/**
 * Returns encoded input, with replacement calls to replace encoded strings with the originals.
 *
 * Worst case O(n^4), although limited to largeValue * O(n^2) by the limited substring length range.
 */
async function encode(input, config, round, logger) {
    // Double escape escape characters, as they are stripped away by eval at some point?
    const escapedInput = utils.doubleEscape(input);
    // Find characters that can be used for substituting repeating chunks of code
    let reservedForIdCounters = config.useAlphanumericMultiCharacterKeys ? "0123456789abcdefghijklmnopqrstuvwxyz" : "0123456789";
    let unusedCharacters = utils.findUnusedCharacters(escapedInput, reservedForIdCounters);
    // We need at least two unused characters for anything
    if (unusedCharacters.length < 2) {
        logger.warn("Could not find two or more unused (ascii) characters to use for encoding id:s, selfextractor will not compress input");
        return input;
    }
    // Use one unused character as separator between encoded string and replacements strings
    let separatorChar = unusedCharacters[0];
    let keyCharacters = unusedCharacters.slice(1);
    let singleKeyCharCount = Math.floor(config.fractionOfSingleCharacterKeys * keyCharacters.length);
    // Best result so far, start out with dummy result (current input)
    let bestResult = { substitutions: new Map(), value: 0, sourceWithReplacements: input };
    // Ensure the process is repeatable, so use a random seed
    let random = Random.create(config.randomSeed);
    // Run round
    let currentResult = findSubstitutions(escapedInput, keyCharacters, singleKeyCharCount, random, config.topReplacementsToSelectFrom, config);
    // Update best result if needed
    if (currentResult.value > bestResult.value) {
        bestResult = currentResult;
    }
    // Build unpacking program using substitutions and substituted source
    return buildUnpacker(bestResult.substitutions, bestResult.sourceWithReplacements, separatorChar, keyCharacters, singleKeyCharCount, config);
}
function findSubstitutions(source, substitutionCharacters, singleKeyCharCount, random, substringsToSelectFrom, config) {
    let modifiedSource = source;
    let fixedOverhead = 0; // Keys are not stored
    let skip = new Set();
    let replacements = new Map();
    let substitutionCount = 0;
    let id = undefined;
    let selectedReplacement = undefined;
    // Do one replacement at a time, always finding the best replacements on the remaoining string
    // This also has the advantage that earlier replacements can be shortened further if they appear in common patterns.
    do {
        // Find next shortest available id (as long as there are any)
        id = claculateKey(substitutionCount, substitutionCharacters, singleKeyCharCount, config);
        if (id != undefined) {
            // Select the n:th best replacement to use
            let clampedFocus = Math.min(1, Math.max(0, config.selectionFocus));
            let selectedIndex = Math.floor(utils.mix(clampedFocus, random.random(), random.random() * random.random() * random.random()) * substringsToSelectFrom);
            skip.clear();
            // Find substring to replace (returns undefined if it doesn't improve compression)
            selectedReplacement = undefined;
            for (let i = 0; i <= selectedIndex; i++) {
                // Find next best replacement
                let currentReplacementResult = utils.findMostValuableReplacement([modifiedSource], substitutionCount, id.length, 0, fixedOverhead, 2, MaxReplacedStringLength, false, false, skip);
                if (currentReplacementResult != undefined) {
                    // Don't use this same replacement string again for this id
                    skip.add(currentReplacementResult.replacement);
                    // Keep result, in case the n:th result is not available
                    selectedReplacement = currentReplacementResult;
                }
            }
            if (selectedReplacement != undefined) {
                substitutionCount++;
                // Apply the replacement to the source
                modifiedSource = utils.replaceAll(modifiedSource, selectedReplacement.replacement, id);
                // Apply the replacement to all earlier replacement strings
                for (let p of replacements.values()) {
                    p.replacement = utils.replaceAll(p.replacement, selectedReplacement.replacement, id);
                }
                // Store new replacement
                replacements.set(id, selectedReplacement);
            }
        }
    } while (id != undefined && selectedReplacement != undefined);
    // Calculate total compression value of the result
    // Size reduction of original source, minus storage space needed for replacements
    // and separators between them
    let totalValue = source.length - modifiedSource.length;
    for (let r of replacements.values()) {
        // Subtract key storage need
        totalValue -= r.replacement.length;
        // Separator char between replacements
        totalValue -= 1;
    }
    return {
        substitutions: replacements,
        sourceWithReplacements: modifiedSource,
        value: totalValue
    };
}
function claculateKey(i, substitutionCharacters, singleKeyCharCount, config) {
    if (substitutionCharacters.length <= 0)
        return undefined; // No unused characters
    // Rest can be followed by one other id character
    let multiKeyCount = substitutionCharacters.length - singleKeyCharCount;
    if (i < singleKeyCharCount)
        return substitutionCharacters[i];
    else {
        let k = i - singleKeyCharCount;
        let n = Math.floor(k / multiKeyCount);
        let suffix = config.useAlphanumericMultiCharacterKeys ? n.toString(36) : '' + n;
        let result = substitutionCharacters[singleKeyCharCount + k % multiKeyCount] + suffix;
        // Only allow up to two character long codes
        return result.length <= 2 ? result : undefined;
    }
}
function buildUnpacker(replacements, encodedSource, separator, keyCharacters, singleKeyCount, config) {
    let replacementValues = utils.mapMap(replacements, (k, v) => v.replacement);
    let replacementCount = replacementValues.length;
    let singleKeyChars = keyCharacters.slice(0, singleKeyCount).join('');
    let multiKeyChars = keyCharacters.slice(singleKeyCount).join('');
    let multiKeyCharCount = multiKeyChars.length;
    let unpacker = `` +
        // String with replacement values and encoded source, all separated by the separator
        `d=${utils.quoteString(encodedSource + separator + replacementValues.join(separator))}` +
        // Split by separator to get a list of values
        `.split(${utils.quoteString(separator)});` +
        // Loop replacement values, from last applied to first
        // The start of the data list contains the source (the loop terminates as soon as i is 0, so it is not used as a replacement)
        `for(i=${replacementCount};i;i--)` +
        // Loop the remainder of the replacement values and the encoded value
        `for(j=i;j;)` +
        // Update the data entries after the current replacement,
        // replacing the replacement key with the replacement value
        // Also decrement j first (this also skips considering the key we are using)
        `d[--j]=d[j]` +
        // Calculate the key, and split the other replacement value or the final code by it
        `.split(` +
        // Calculate k, the index for two-character keys
        `(k=i-${singleKeyCount + 1})<0?` +
        // For the first singleKeyCount characters, use separate single char keys
        `${utils.quoteString(singleKeyChars)}[i-1]:` +
        // For larger indexes, use two characters, a key character and an index digit
        `${utils.quoteString(multiKeyChars)}[k%${multiKeyCharCount}]+` +
        // Append digit from 0 to 9, or an alphanumeric, depending on config setting
        // ~~ is a double-xor trick that can be used to drop all fractions.
        (config.useAlphanumericMultiCharacterKeys ?
            `(~~(k/${multiKeyCharCount})).toString(36)` :
            `~~(k/${multiKeyCharCount})`) +
        `)` +
        // Join the string list, putting the replacement value in the gaps left
        // by splitting with the key
        `.join(d[i]);` +
        // The result can be found in d[0]
        // Evaluate it using an indeirect eval, as that apparently runs about 15-30% faster
        // ( https://www.pouet.net/topic.php?which=8770&page=1 )
        `(1,eval)(d[0])`;
    return unpacker;
}
//# sourceMappingURL=recursiveReplacer.js.map