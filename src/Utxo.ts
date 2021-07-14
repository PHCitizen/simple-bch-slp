import * as Bitcore from "bitcore-lib-cash";
import bchaddr from "bchaddrjs-slp";
import { GrpcClient } from "grpc-bchrpc-node";
import * as Interface from "./interface";
const fetch = require("node-fetch");

const gslpAddressCacheMap = new Map();
function parseUtxo(gutxos: any) {
    const utxos = [];
    for (const output of gutxos.getOutputsList()) {
        const outpoint = output.getOutpoint();

        let slp: any = null;
        if (output.hasSlpToken()) {
            const gslp: any = output.getSlpToken();
            slp = {};
            slp.tokenId = Buffer.from(gslp.getTokenId()).toString("hex");
            slp.amount = gslp.getAmount();
            slp.isMintBaton = gslp.getIsMintBaton();

            const gslpAddressStr = gslp.getAddress();
            if (!gslpAddressCacheMap.has(gslpAddressStr)) {
                gslpAddressCacheMap.set(
                    gslpAddressStr,
                    Bitcore.Address.fromString(
                        bchaddr.toCashAddress(gslpAddressStr)
                    )
                );
            }
            slp.address = gslpAddressCacheMap.get(gslpAddressStr);
            slp.decimals = gslp.getDecimals();
            slp.slpAction = gslp.getSlpAction();
            slp.tokenType = gslp.getTokenType();
        }

        utxos.push({
            txid: Buffer.from(outpoint.getHash_asU8().reverse()).toString(
                "hex"
            ),
            vout: outpoint.getIndex(),
            value: output.getValue(),
            pubkey_script: Buffer.from(output.getPubkeyScript_asU8()).toString(
                "hex"
            ),
            block_height: output.getBlockHeight(),
            coinbase: output.getIsCoinbase(),
            slp,
        });
    }
    return utxos;
}

export class GRPC {
    private client;
    constructor(url: string, testnet: boolean = false) {
        this.client = new GrpcClient({
            url,
            testnet,
        });
    }
    async getAddressUtxos(
        address: string
    ): Promise<Interface.Utxo[] | Interface.Error> {
        let gutxos;
        try {
            gutxos = await this.client.getAddressUtxos({
                address,
                includeMempool: true,
                includeTokenMetadata: true,
            });
        } catch (e) {
            return { error: true, message: (e as Error).message };
        }

        return parseUtxo(gutxos);
    }
    async broadcastTx(
        tx: Bitcore.Transaction,
        skipSlpValidityChecks: boolean = false
    ): Promise<Interface.tx> {
        try {
            const res = await this.client.submitTransaction({
                txnHex: tx.serialize(),
                skipSlpValidityChecks,
            });

            return {
                error: false,
                txid: Buffer.from(res.getHash_asU8()).reverse().toString("hex"),
                message: "",
            };
        } catch (e) {
            return { error: true, txid: "", message: (e as Error).message };
        }
    }
    utxoToUnspentOutput(
        utxo: Interface.Utxo
    ): Bitcore.Transaction.UnspentOutput {
        return new Bitcore.Transaction.UnspentOutput({
            txId: utxo.txid,
            outputIndex: utxo.vout,
            script: new Bitcore.Script(utxo.pubkey_script),
            satoshis: utxo.value,
        });
    }
}

function restParse(
    utxos: Interface.Utxo[]
): Interface.Utxo[] | Interface.Error {
    const data: Interface.Utxo[] = [];
    for (const utxo of utxos) {
        if (utxo.slp) {
            utxo.slp.address = Bitcore.Address.fromString(
                bchaddr.toCashAddress(utxo.slp.address)
            );
        }
        data.push(utxo);
    }
    return data;
}
export class REST {
    private url: string;
    private network: string;
    constructor(url: string, testnet: boolean) {
        this.url = url;
        this.network = "mainnet";
        if (testnet) this.network = "testnet";
    }
    async broadcastTx(
        txnHex: Bitcore.Transaction,
        skipSlpValidityChecks: boolean = false
    ): Promise<Interface.tx> {
        const tx = txnHex.serialize();
        let gutxos;
        try {
            gutxos = await fetch(`${this.url}/${this.network}/brodcast`, {
                method: "POST",
                headers: {
                    accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    transaction: tx,
                    skipSlpValidityChecks,
                }),
            });
        } catch (e) {
            return { error: true, txid: "", message: (e as Error).message };
        }
        let res;
        if (gutxos.status != 200) {
            //if the response have body return it else return status text
            try {
                res = await gutxos.json();
                return { error: true, txid: "", message: res?.message };
            } catch (e) {
                return { error: true, txid: "", message: gutxos.statusText };
            }
        }
        res = await gutxos.json();
        return {
            error: false,
            txid: res.txid,
            message: "",
        };
    }

    async getAddressUtxos(
        address: string
    ): Promise<Interface.Utxo[] | Interface.Error> {
        let gutxos;
        try {
            gutxos = await fetch(`${this.url}/${this.network}/${address}`, {
                method: "GET",
                headers: {
                    accept: "application/json",
                    "Content-Type": "application/json",
                },
            });
        } catch (e) {
            return { error: true, message: (e as Error).message };
        }

        let res;
        if (gutxos.status != 200) {
            //if the response have body return it else return status text
            try {
                res = await gutxos.json();
                return { error: true, message: res?.message };
            } catch (e) {
                return { error: true, message: gutxos.statusText };
            }
        }
        res = await gutxos.json();
        return restParse(res);
    }

    utxoToUnspentOutput(
        utxo: Interface.Utxo
    ): Bitcore.Transaction.UnspentOutput {
        return new Bitcore.Transaction.UnspentOutput({
            txId: utxo.txid,
            outputIndex: utxo.vout,
            script: new Bitcore.Script(utxo.pubkey_script),
            satoshis: utxo.value,
        });
    }
}
