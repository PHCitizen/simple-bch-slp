import { Wallet } from "./Wallet";
import * as Interface from "./interface";
import * as Bitcore from "bitcore-lib-cash";
import { Helper } from "./Helper";
import * as Utxo from "./Utxo";

export default class SIMPLESLP {
    private data: Interface.URLs;
    private _Helper: Helper;
    private testnet;
    constructor(data: Interface.Data = {}) {
        this.testnet = data.testnet || false;
        const method = data.method || "grpc";
        const slpSocket =
            data.slpSocket || "https://slpstream.fountainhead.cash";
        const bchSocket = data.bchSocket || "https://bitsocket.bch.sx";

        let slpDbUrl = data.slpDbUrl || "https://slpdb.fountainhead.cash";
        let grpcUrl = data.grpcUrl || "bchd.fountainhead.cash:443";

        if (this.testnet) {
            grpcUrl = data.grpcUrl || "bchd-testnet.greyh.at:18335";
            slpDbUrl =
                data.slpDbUrl || "https://slpdb-testnet.fountainhead.cash";
        }
        if (method == "rest") grpcUrl = data.grpcUrl || "";

        if (grpcUrl.endsWith("/")) grpcUrl = grpcUrl.slice(0, -1);

        let client: any = new Utxo.REST(grpcUrl, this.testnet);
        if (method == "grpc") {
            client = new Utxo.GRPC(grpcUrl, this.testnet);
        }
        this.data = {
            grpcUrl,
            method,
            slpDbUrl,
            slpSocket,
            bchSocket,
            testnet: this.testnet,
            client,
        };
        this._Helper = new Helper(this.data);
    }

    fromWIF(wif: string): Wallet | Interface.Error {
        let network = "mainnet";
        if (this.testnet) network = "testnet";
        let privkey: Bitcore.PrivateKey;
        try {
            privkey = new Bitcore.PrivateKey(wif, network);
        } catch (e) {
            return { error: true, message: (e as Error).message };
        }
        return new Wallet(privkey, this.data);
    }

    async fromSeed(
        seed: string,
        derivationPath: string = "m/44'/0'/0'/0/0"
    ): Promise<Wallet | Interface.Error> {
        const wif = await this._Helper.seedToWIF(
            seed,
            derivationPath,
            this.testnet
        );
        if (wif.error) return wif;
        let privkey: Bitcore.PrivateKey;
        try {
            privkey = new Bitcore.PrivateKey(wif.wif);
        } catch (e) {
            return { error: true, message: (e as Error).message };
        }
        return new Wallet(privkey, this.data);
    }
    async create(
        derivationPath: string = "m/44'/0'/0'/0/0"
    ): Promise<Interface.Error | Interface.createInterface> {
        const seed = this._Helper.createNew();
        const wif = await this._Helper.seedToWIF(
            seed,
            derivationPath,
            this.data.testnet
        );
        let network = "mainnet";
        if (this.data.testnet) network = "testnet";
        if (wif.error) return wif;
        const privKey = new Bitcore.PrivateKey(wif.wif, network);
        const bch = privKey.toAddress().toString();
        const slp = this._Helper.Address.toSlp(bch);
        const legacy = this._Helper.Address.toLegacy(bch);
        return {
            seed,
            derivationPath,
            wif: wif.wif,
            bch,
            slp,
            legacy,
        };
    }
}
