import * as Bitcore from "bitcore-lib-cash";
import bchaddr from "bchaddrjs-slp";
import * as Interface from "./interface";
import * as slpMdm from "slp-mdm";
import * as BIP39 from "bip39";
const randomBytes = require("randombytes");

const coininfo = require("coininfo");
const Bitcoin = require("@bitcoin-dot-com/bitcoincashjs2-lib");

export class Helper {
    protected data: Interface.URLs;
    protected Utxo;
    constructor(data: Interface.URLs) {
        this.data = data;
        this.Utxo = data.client;
    }
    async seedToWIF(
        seed: string,
        derivePath: string,
        testnet: boolean
    ): Promise<Interface.Error | { error: false; wif: string }> {
        const isValidMnemonic = validateSeed(seed);
        if (isValidMnemonic.error) return isValidMnemonic;
        const seedBuffer = await BIP39.mnemonicToSeed(seed, "");
        let bitcoinCash = coininfo.bitcoincash.main.toBitcoinJS();
        if (testnet) bitcoinCash = coininfo.bitcoincash.test.toBitcoinJS();
        const wif = Bitcoin.HDNode.fromSeedBuffer(seedBuffer, bitcoinCash)
            .derivePath(derivePath)
            .keyPair.toWIF();
        return { error: false, wif };
    }
    get Address() {
        return {
            toCash: function (address: string) {
                return bchaddr.toCashAddress(address);
            },
            toSlp: function (address: string) {
                return bchaddr.toSlpAddress(address);
            },
            toLegacy: function (address: string) {
                return bchaddr.toLegacyAddress(address);
            },
        };
    }
    get convert() {
        const notScientific = this.notScientific;
        return {
            toBCH: function (satoshi: number) {
                const res = satoshi / 100000000;
                return notScientific(res);
            },
            toBits: function (satoshi: number) {
                const res = satoshi / 100000;
                return notScientific(res);
            },
            toSatoshi: function (satoshi: number) {
                const res = satoshi * 100000000;
                return notScientific(Math.round(res));
            },
        };
    }
    private notScientific(num: number): string {
        return ("" + +num).replace(
            /(-?)(\d*)\.?(\d*)e([+-]\d+)/,
            function (a, b, c, d, e) {
                return e < 0
                    ? b + "0." + Array(1 - e - c.length).join("0") + c + d
                    : b + c + d + Array(e - d.length + 1).join("0");
            }
        );
    }
    get validate() {
        return {
            cashMainnet: function (
                address: string
            ): Interface.Error | Interface.Success {
                try {
                    bchaddr.isCashAddress(address);
                    bchaddr.isMainnetAddress(address);
                } catch (e) {
                    return { error: true, message: (e as Error).message };
                }
                return { error: false };
            },
            slpMainnet: function (
                address: string
            ): Interface.Error | Interface.Success {
                try {
                    bchaddr.isSlpAddress(address);
                    bchaddr.isMainnetAddress(address);
                } catch (e) {
                    return { error: true, message: (e as Error).message };
                }
                return { error: false };
            },
        };
    }
    createNew(): string {
        return BIP39.generateMnemonic(
            128,
            randomBytes,
            BIP39.wordlists.english
        );
    }
    getfeeNeedBCH(
        utxosBCH: Interface.Utxo[],
        address: string,
        toAddress: string,
        amount: number
    ): number {
        let inputUtxos = [];
        for (const utxo of utxosBCH) {
            inputUtxos.push(this.Utxo.utxoToUnspentOutput(utxo));
            if (inputUtxos.reduce((a, v) => a + v.satoshis, 0) > amount) break;
        }
        const tx = new Bitcore.Transaction()
            .from(inputUtxos)
            .to(toAddress, amount)
            .change(address)
            .feePerByte(1)
            .getFee();
        return tx;
    }
    mintParent(
        inputUtxos: Bitcore.Transaction.UnspentOutput[],
        address: string,
        data: Interface.NftData,
        amount: number
    ): Bitcore.Transaction {
        const tx = new Bitcore.Transaction()
            .from(inputUtxos)
            .addOutput(
                new Bitcore.Transaction.Output({
                    script: Bitcore.Script.fromBuffer(
                        slpMdm.NFT1.Group.genesis(
                            data.symbol,
                            data.name,
                            data.documentUri,
                            data.documentHash,
                            0,
                            2,
                            new slpMdm.BN(amount)
                        )
                    ),
                    satoshis: 0,
                })
            )
            .to(address, 546)
            .to(address, 546)
            .change(address)
            .feePerByte(1);
        return tx;
    }
    mintAdditional(
        inputUtxos: Bitcore.Transaction.UnspentOutput[],
        address: string,
        tokenId: string,
        amount: number
    ): Bitcore.Transaction {
        const tx = new Bitcore.Transaction()
            .from(inputUtxos)
            .addOutput(
                new Bitcore.Transaction.Output({
                    script: Bitcore.Script.fromBuffer(
                        slpMdm.NFT1.Group.mint(
                            tokenId,
                            2,
                            new slpMdm.BN(amount)
                        )
                    ),
                    satoshis: 0,
                })
            )
            .to(address, 546)
            .to(address, 546)
            .change(address)
            .feePerByte(1);
        return tx;
    }
    split(
        inputUtxos: Bitcore.Transaction.UnspentOutput[],
        address: string,
        tokenId: string,
        groupAmount: number,
        amount: number
    ): Bitcore.Transaction {
        const tx = new Bitcore.Transaction()
            .from(inputUtxos)
            .addOutput(
                new Bitcore.Transaction.Output({
                    script: Bitcore.Script.fromBuffer(
                        slpMdm.NFT1.Group.send(tokenId, [
                            new slpMdm.BN(groupAmount - amount),
                            new slpMdm.BN(amount),
                        ])
                    ),
                    satoshis: 0,
                })
            )
            .to(address, 546)
            .to(address, 546)
            .change(address)
            .feePerByte(1);
        return tx;
    }
}
function validateSeed(mnemonic: string): Interface.Error | { error: false } {
    const wordlist = BIP39.wordlists.english;
    const words = mnemonic.split(" ");
    if (words.length === 0) return { error: true, message: "Blank mnemonic" };
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (wordlist.indexOf(word) == -1) {
            const nearestWord = findNearestWord(word, wordlist);
            return {
                error: true,
                message: `${word} is not in wordlist, did you mean ${nearestWord}?`,
            };
        }
    }
    const isValid = BIP39.validateMnemonic(mnemonic, wordlist);
    if (!isValid)
        return {
            error: true,
            message: "invalid seed phrases",
        };
    return {
        error: false,
    };
}
function findNearestWord(word: string, wordlist: string[]) {
    let minDistance = 99;
    let closestWord = wordlist[0];
    for (let i = 0; i < wordlist.length; i++) {
        const comparedTo = wordlist[i];
        if (comparedTo.indexOf(word) == 0) return comparedTo;

        const distance = Levenshtein.get(word, comparedTo);
        if (distance < minDistance) {
            closestWord = comparedTo;
            minDistance = distance;
        }
    }
    return closestWord;
}

// The following code is from: https://raw.githubusercontent.com/iancoleman/bip39/7ff86d4c983f1e8c80b87b31acfd69fcf98c1b82/src/js/levenshtein.js

/**
 * Extend an Object with another Object's properties.
 *
 * The source objects are specified as additional arguments.
 *
 * @param dst Object the object to extend.
 *
 * @return Object the final object.
 */

const _extend: any = function (dst: any): any {
    const sources: any = Array.prototype.slice.call(arguments, 1);
    for (let i: number = 0; i < sources.length; ++i) {
        const src = sources[i];
        for (const p in src) if (src.hasOwnProperty(p)) dst[p] = src[p];
    }
    return dst;
};

/**
 * Defer execution of given function.
 * @param  {Function} func
 */
const _defer: any = function (func: any): any {
    if (typeof setImmediate === "function") return setImmediate(func);

    return setTimeout(func, 0);
};

/**
 * Based on the algorithm at http://en.wikipedia.org/wiki/Levenshtein_distance.
 */
var Levenshtein: any = {
    /**
     * Calculate levenshtein distance of the two strings.
     *
     * @param str1 String the first string.
     * @param str2 String the second string.
     * @return Integer the levenshtein distance (0 and above).
     */
    get: function (str1: any, str2: any) {
        // base cases
        if (str1 === str2) return 0;
        if (str1.length === 0) return str2.length;
        if (str2.length === 0) return str1.length;

        // two rows
        let prevRow: any[] = new Array(str2.length + 1),
            curCol,
            nextCol,
            i,
            j,
            tmp;

        // initialise previous row
        for (i = 0; i < prevRow.length; ++i) prevRow[i] = i;

        // calculate current row distance from previous row
        for (i = 0; i < str1.length; ++i) {
            nextCol = i + 1;

            for (j = 0; j < str2.length; ++j) {
                curCol = nextCol;

                // substution
                nextCol =
                    prevRow[j] + (str1.charAt(i) === str2.charAt(j) ? 0 : 1);
                // insertion
                tmp = curCol + 1;
                if (nextCol > tmp) nextCol = tmp;

                // deletion
                tmp = prevRow[j + 1] + 1;
                if (nextCol > tmp) nextCol = tmp;

                // copy current col value into previous (in preparation for next iteration)
                prevRow[j] = curCol;
            }

            // copy last col value into previous (in preparation for next iteration)
            prevRow[j] = nextCol;
        }

        return nextCol;
    },

    /**
     * Asynchronously calculate levenshtein distance of the two strings.
     *
     * @param str1 String the first string.
     * @param str2 String the second string.
     * @param cb Function callback function with signature: function(Error err, int distance)
     * @param [options] Object additional options.
     * @param [options.progress] Function progress callback with signature: function(percentComplete)
     */
    getAsync: function (str1: any, str2: any, cb: any, options: any) {
        options = _extend(
            {},
            {
                progress: null,
            },
            options
        );

        // base cases
        if (str1 === str2) return cb(null, 0);
        if (str1.length === 0) return cb(null, str2.length);
        if (str2.length === 0) return cb(null, str1.length);

        // two rows
        const prevRow: any[] = new Array(str2.length + 1);
        let curCol: any;
        let nextCol: any;
        let i: any;
        let j: any;
        let tmp: any;
        let startTime: any;
        let currentTime: any;

        // initialise previous row
        for (i = 0; i < prevRow.length; ++i) prevRow[i] = i;

        nextCol = 1;
        i = 0;
        j = -1;

        var __calculate = function () {
            // reset timer
            startTime = new Date().valueOf();
            currentTime = startTime;

            // keep going until one second has elapsed
            while (currentTime - startTime < 1000) {
                // reached end of current row?
                if (str2.length <= ++j) {
                    // copy current into previous (in preparation for next iteration)
                    prevRow[j] = nextCol;

                    // if already done all chars
                    if (str1.length <= ++i) return cb(null, nextCol);

                    // else if we have more left to do

                    nextCol = i + 1;
                    j = 0;
                }

                // calculation
                curCol = nextCol;

                // substution
                nextCol =
                    prevRow[j] + (str1.charAt(i) === str2.charAt(j) ? 0 : 1);
                // insertion
                tmp = curCol + 1;
                if (nextCol > tmp) nextCol = tmp;

                // deletion
                tmp = prevRow[j + 1] + 1;
                if (nextCol > tmp) nextCol = tmp;

                // copy current into previous (in preparation for next iteration)
                prevRow[j] = curCol;

                // get current time
                currentTime = new Date().valueOf();
            }

            // send a progress update?
            if (null !== options.progress) {
                try {
                    options.progress.call(null, (i * 100.0) / str1.length);
                } catch (err) {
                    return cb(
                        `Progress callback: ${(err as Error).toString()}`
                    );
                }
            }

            // next iteration
            _defer(__calculate);
        };

        __calculate();
    },
};
