import * as Interface from "./interface";
import * as Bitcore from "bitcore-lib-cash";
import { Helper } from "./Helper";
import BCH from "./BCH";
import SLP from "./SLP";
const QRCode = require("qrcode");

export class Wallet {
    protected wif: string;
    protected privKey: Bitcore.PrivateKey;
    protected address: Bitcore.Address;
    protected _Helper: Helper;
    protected data: Interface.URLs;
    constructor(privKey: Bitcore.PrivateKey, data: Interface.URLs) {
        this.privKey = privKey;
        this.wif = privKey.toWIF();
        this.address = privKey.toAddress();
        this._Helper = new Helper(data);
        this.data = data;
    }
    toWIF(): string {
        return this.wif;
    }
    get Address() {
        const bch = this.address.toString();
        const slp = this._Helper.Address.toSlp(bch);
        const legacy = this._Helper.Address.toLegacy(bch);
        const self = this;
        return {
            toCash: function (qrcode = false, amount = 0) {
                if (qrcode) return self._Qrcode(bch, amount);
                return bch;
            },
            toSlp: function (qrcode = false, amount = 0) {
                if (qrcode) return self._Qrcode(slp, amount);
                return slp;
            },
            toLegacy: function (qrcode = false, amount = 0) {
                if (qrcode) return self._Qrcode(legacy, amount);
                return legacy;
            },
        };
    }

    protected _Qrcode(
        address: string,
        amount: number
    ): Interface.Error | Interface.QrUri {
        const opts = {
            errorCorrectionLevel: "L",
            type: "image/jpeg",
            margin: 2,
        };
        let text = `${address}?amount=${amount.toString()}`;
        if (amount == 0) text = address;

        const generatedQR = QRCode.toDataURL(text, opts)
            .then((url: string) => {
                return { error: false, url, address, amount };
            })
            .catch((err: Error) => {
                return { error: true, message: err.message };
            });

        return generatedQR;
    }
}
export interface Wallet extends BCH, SLP {}
applyMixins(Wallet, [BCH, SLP]);
function applyMixins(derivedCtor: any, constructors: any[]) {
    constructors.forEach((baseCtor) => {
        Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
            Object.defineProperty(
                derivedCtor.prototype,
                name,
                Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ||
                    Object.create(null)
            );
        });
    });
}
