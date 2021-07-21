import * as Bitcore from "bitcore-lib-cash";
import * as Interface from "./interface";
import { Helper } from "./Helper";

export default class BCH {
    constructor(
        protected privKey: Bitcore.PrivateKey,
        protected data: Interface.URLs,
        protected address: Bitcore.Address,
        protected _Helper: Helper
    ) {
        this.privKey = privKey;
        this.data = data;
        this.address = address;
        this._Helper = _Helper;
    }
    get BCH() {
        const self = this;
        const Utxo = this.data.client;
        return {
            balance: async function (
                format: "satoshi" | "bch" | "bits" = "satoshi"
            ): Promise<string | Interface.Error> {
                const utxos = await Utxo.getAddressUtxos(
                    self.address.toString()
                );
                if ("error" in utxos) return utxos;
                const bch = utxos.reduce(
                    (a: number, v: Interface.Utxo) => a + v.value,
                    0
                );
                if (format == "bch") return self._Helper.convert.toBCH(bch);
                if (format == "bits") return self._Helper.convert.toBits(bch);
                return bch.toString();
            },
            maxAmount: async function (
                format: "satoshi" | "bch" | "bits" = "satoshi"
            ): Promise<string | Interface.Error> {
                const utxos = await Utxo.getAddressUtxos(
                    self.address.toString()
                );
                if ("error" in utxos) return utxos;
                const bch = utxos
                    .filter((v) => !v.slp)
                    .reduce((a, v) => a + v.value, 0);
                if (format == "bch") return self._Helper.convert.toBCH(bch);
                if (format == "bits") return self._Helper.convert.toBits(bch);
                return bch.toString();
            },
            send: async function (
                toAddress: string,
                amounts: number,
                getFee: boolean = false
            ): Promise<Interface.tx | Interface.Error | number> {
                const amount = Number(self._Helper.convert.toSatoshi(amounts));
                const valid = self._Helper.validate.cashMainnet(toAddress);
                if (valid.error) return valid;
                if (amount < 546)
                    return {
                        error: true,
                        message: `transaction rejected! amount trying to send is very small`,
                    };
                const utxos = await Utxo.getAddressUtxos(
                    self.address.toString()
                );
                if ("error" in utxos) return utxos;

                const utxosBCH = utxos.filter((v) => !v.slp);
                const balance = utxosBCH.reduce((a, v) => a + v.value, 0);

                const inputUtxos = [];
                for (const utxo of utxosBCH) {
                    inputUtxos.push(Utxo.utxoToUnspentOutput(utxo));
                    if (
                        inputUtxos.reduce((a, v) => a + v.satoshis, 0) >
                        amount + 5000
                    )
                        break;
                }
                const tx = new Bitcore.Transaction()
                    .from(inputUtxos)
                    .to(toAddress, amount)
                    .change(self.address)
                    .feePerByte(1)
                    .sign(self.privKey);
                if (getFee) return tx.getFee();
                if (balance < amount + tx.getFee())
                    return {
                        error: true,
                        message: `insufficient balance. You have ${balance.toString()} satoshi. please subtract ${tx.getFee()} satoshi as the fee`,
                    };

                const txid = await Utxo.broadcastTx(tx);
                return txid;
            },
            sendAll: async function (
                toAddress: string,
                getFee: boolean = false
            ): Promise<Interface.tx | Interface.Error | number> {
                const valid = self._Helper.validate.cashMainnet(toAddress);
                if (valid.error) return valid;

                const utxos = await Utxo.getAddressUtxos(
                    self.address.toString()
                );
                if ("error" in utxos) return utxos;

                const utxosBCH = utxos.filter((v) => !v.slp);
                const balance = utxosBCH.reduce((a, v) => a + v.value, 0);
                if (balance < 546)
                    return {
                        error: true,
                        message: "amount trying to send is very small",
                    };

                const inputUtxos = [];
                for (const utxo of utxosBCH) {
                    inputUtxos.push(Utxo.utxoToUnspentOutput(utxo));
                }
                const tx = new Bitcore.Transaction()
                    .from(inputUtxos)
                    .change(toAddress)
                    .feePerByte(1)
                    .sign(self.privKey);
                if (getFee) return tx.getFee();
                const txid = await Utxo.broadcastTx(tx);
                return txid;
            },
        };
    }
}
