import * as Bitcore from "bitcore-lib-cash";
import bchaddr from "bchaddrjs-slp";
import * as Interface from "./interface";
import * as slpMdm from "slp-mdm";
import * as BIP39 from "bip39";
const randomBytes = require("randombytes");
const Levenshtein = require("fast-levenshtein");

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
        return {
            toBCH: function (satoshi: number) {
                const res = satoshi / 100000000;
                return res.toLocaleString("fullwide", { useGrouping: false });
            },
            toBits: function (satoshi: number) {
                const res = satoshi / 100000;
                return res.toLocaleString("fullwide", { useGrouping: false });
            },
            toSatoshi: function (satoshi: number) {
                const res = satoshi * 100000000;
                return Math.round(res).toLocaleString("fullwide", {
                    useGrouping: false,
                });
            },
        };
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
