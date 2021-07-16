import * as Bitcore from "bitcore-lib-cash";
import * as Interface from "./interface";
import * as slpMdm from "slp-mdm";
import { Helper } from "./Helper";
const fetch = require("node-fetch");

export default class SLP {
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
    private mergeUtxoWithSameInfo(utxos: Interface.Utxo[]) {
        const data: Interface.Utxo[] = [];
        const filtered = utxos
            .filter((v) => v.slp)
            .sort(function (a, b) {
                return b.slp.amount - a.slp.amount;
            });
        for (const a of filtered) {
            let i = 0;
            let status = true;
            for (const v of data) {
                if (a.slp.tokenId == v.slp.tokenId) {
                    status = false;
                    data[i].slp.amount += a.slp.amount;
                    break;
                }
                i += 1;
            }
            if (status) data.push(a);
        }
        return data;
    }
    get SLP() {
        const self = this;
        const Utxo = this.data.client;
        return {
            balance: async function (
                tokenIdSelected: "all" | Array<string> = "all"
            ): Promise<Interface.Error | Interface.NftDetails[]> {
                let utxos = await Utxo.getAddressUtxos(self.address.toString());
                if ("error" in utxos) return utxos;
                if (utxos.length == 0) return [];
                if (tokenIdSelected == "all") {
                    utxos = self.mergeUtxoWithSameInfo(utxos);
                } else {
                    utxos = self
                        .mergeUtxoWithSameInfo(utxos)
                        .filter((v) => tokenIdSelected.includes(v.slp.tokenId));
                }
                const token = utxos.map((v) => {
                    return { id: v.slp.tokenId, amount: v.slp.amount };
                });
                const tokenId = [
                    ...new Set(
                        token.map((v) => {
                            return v.id;
                        })
                    ),
                ];
                const tokenJoined = tokenId.join("|");
                const schema = `{"v": 3,"q": {"db": ["g"],"find":{"tokenDetails.tokenIdHex": { "$regex": "${tokenJoined}", "$options": "i" },"graphTxn.details.transactionType": "GENESIS"},"project": {"_id": 0,"id": "$tokenDetails.tokenIdHex","parentTokenId": "$tokenDetails.nftGroupIdHex","name": "$graphTxn.details.name","symbol": "$graphTxn.details.symbol","documentUri": "$graphTxn.details.documentUri","documentHash": "$graphTxn.details.documentSha256Hex"}}}`;
                const base64Data = Buffer.from(schema).toString("base64");
                let res;
                try {
                    res = await fetch(self.data.slpDbUrl + "/q/" + base64Data);
                } catch (e) {
                    return { error: true, message: (e as Error).message };
                }
                const json = (await res.json()).g;
                const datas: Interface.NftDetails[] = [];
                token.forEach((a) => {
                    const nftDetails = json.filter((v: Interface.dbData) => {
                        return v.id == a.id;
                    })[0];

                    const details = {
                        id: a.id,
                        amount: a.amount,
                        parentTokenId: nftDetails.parentTokenId,
                        name: nftDetails.name,
                        symbol: nftDetails.symbol,
                        documentUri: nftDetails.documentUri,
                        documentHash: nftDetails.documentHash,
                    };

                    datas.push(details);
                });
                return datas;
            },
            send: async function (
                toAddress: string,
                tokenIdToSend: string,
                amount = 1,
                getFee = false
            ): Promise<number | Interface.Error | Interface.tx> {
                const valid = self._Helper.validate.slpMainnet(toAddress);
                if (valid.error) return valid;

                const utxos = await Utxo.getAddressUtxos(
                    self.address.toString()
                );
                if ("error" in utxos) return utxos;
                const utxosBCH = utxos.filter((v) => !v.slp);
                const balance = utxosBCH.reduce((a, v) => a + v.value, 0);

                const utxosSLP = utxos
                    .filter((v) => v.slp)
                    .sort(function (a, b) {
                        return b.slp.amount - a.slp.amount;
                    })
                    .filter((v) => {
                        return v.slp.tokenId == tokenIdToSend;
                    });
                if (utxosSLP.length == 0)
                    return {
                        error: true,
                        message:
                            "Cannot find the specified token in your address",
                    };

                const utxosSlpToSend: Interface.Utxo[] = [];
                let groupUtxosAmount = 0;
                for (const gutxoSlp of utxosSLP) {
                    utxosSlpToSend.push(gutxoSlp);
                    groupUtxosAmount += Number(gutxoSlp.slp.amount);
                    if (groupUtxosAmount >= amount) break;
                }
                if (groupUtxosAmount < amount)
                    return {
                        error: true,
                        message: "insufficient token balace",
                    };

                let sendParent = false;
                if (utxosSLP[0].slp.tokenType == 129) sendParent = true;
                const changeToken = groupUtxosAmount - amount;
                const sendToAddr = self._Helper.Address.toCash(toAddress);
                let script: Bitcore.Script;
                if (sendParent == true) {
                    const slpOutput = [new slpMdm.BN(amount.toString())];
                    if (changeToken > 0)
                        slpOutput.push(new slpMdm.BN(changeToken.toString()));

                    script = Bitcore.Script.fromBuffer(
                        slpMdm.NFT1.Group.send(tokenIdToSend, slpOutput)
                    );
                } else {
                    script = Bitcore.Script.fromBuffer(
                        slpMdm.NFT1.Child.send(tokenIdToSend, [
                            new slpMdm.BN(amount.toString()),
                        ])
                    );
                }
                const inputUtxos = utxosSlpToSend.map((v) =>
                    Utxo.utxoToUnspentOutput(v)
                );
                for (const utxo of utxosBCH) {
                    inputUtxos.push(Utxo.utxoToUnspentOutput(utxo));
                    if (inputUtxos.reduce((a, v) => a + v.satoshis, 0) > 5000)
                        break;
                }

                let tx = new Bitcore.Transaction()
                    .from(inputUtxos)
                    .addOutput(
                        new Bitcore.Transaction.Output({
                            script,
                            satoshis: 0,
                        })
                    )
                    .to(sendToAddr, 546);
                if (changeToken > 0) tx = tx.to(self.address, 546);
                tx = tx.change(self.address).feePerByte(1);
                const feeNeed = tx.getFee();

                if (getFee) return feeNeed;
                if (balance < feeNeed)
                    return { error: true, message: "balance too small" };

                tx = tx.sign(self.privKey);
                const txid = await Utxo.broadcastTx(tx);
                return txid;
            },
            parentGenesis: async function (data: {
                name: string;
                symbol: string;
                documentUri: string;
                documentHash: string;
                amount: number;
                fixedSupply?: boolean;
                getFee?: boolean;
            }): Promise<
                | Interface.Error
                | Interface.tx
                | number
                | Interface.mintFixedSupply
            > {
                const utxos = await Utxo.getAddressUtxos(
                    self.address.toString()
                );
                if ("error" in utxos) return utxos;
                const utxosBCH = utxos.filter((v) => !v.slp);
                const balance = utxosBCH.reduce((a, v) => a + v.value, 0);

                const inputUtxos = [];
                for (const utxo of utxosBCH) {
                    inputUtxos.push(Utxo.utxoToUnspentOutput(utxo));

                    if (inputUtxos.reduce((a, v) => a + v.satoshis, 0) > 5000) {
                        break;
                    }
                }
                let tx = self._Helper.mintParent(
                    inputUtxos,
                    self.address.toString(),
                    {
                        symbol: data.symbol,
                        name: data.name,
                        documentUri: data.documentUri,
                        documentHash: data.documentHash,
                    },
                    data.amount
                );
                if (data.getFee) return tx.getFee();
                if (balance < tx.getFee())
                    return { error: true, message: "balance too low" };
                tx = tx.sign(self.privKey);
                const txid = await Utxo.broadcastTx(tx);

                if (txid.error) return txid;
                if (!data.fixedSupply) return txid;
                // if fixed supply ...
                const txid2 = await this.destroyMintBaton(txid.txid);
                return {
                    genesisTxId: txid.txid,
                    mintBatonBurning: txid2,
                };
            },
            destroyMintBaton: async function (
                tokenId: string
            ): Promise<Interface.Error | Interface.tx> {
                const utxos = await Utxo.getAddressUtxos(
                    self.address.toString()
                );
                if ("error" in utxos) return utxos;
                const mintBaton = self.hasTokenInfo(utxos, 129, true, tokenId);
                if (mintBaton.length == 0)
                    return {
                        error: true,
                        message: "mint baton tokenId not found",
                    };
                const utxosBCH = utxos.filter((v) => !v.slp);
                const balance = utxosBCH.reduce((a, v) => a + v.value, 0);

                const inputUtxos = [Utxo.utxoToUnspentOutput(mintBaton[0])];
                for (const utxo of utxosBCH) {
                    inputUtxos.push(Utxo.utxoToUnspentOutput(utxo));

                    if (inputUtxos.reduce((a, v) => a + v.satoshis, 0) > 3000)
                        break;
                }
                let tx = new Bitcore.Transaction()
                    .from(inputUtxos)
                    .change(self.address)
                    .feePerByte(1);
                if (balance < tx.getFee())
                    return { error: true, message: "balance too low" };
                tx = tx.sign(self.privKey);
                const txid = await Utxo.broadcastTx(tx, true);
                return txid;
            },
            addSupply: async function (
                tokenId: string,
                amount: number,
                getFee = false
            ): Promise<Interface.Error | Interface.tx | number> {
                const utxos = await Utxo.getAddressUtxos(
                    self.address.toString()
                );
                if ("error" in utxos) return utxos;
                const utxosBCH = utxos.filter((v) => !v.slp);
                const balance = utxosBCH.reduce((a, v) => a + v.value, 0);

                const batonUtxos = self.hasTokenInfo(utxos, 129, true, tokenId);
                if (batonUtxos.length == 0) {
                    return {
                        error: true,
                        message: `${tokenId} mint baton not found`,
                    };
                }

                const inputUtxos = [Utxo.utxoToUnspentOutput(batonUtxos[0])];
                for (const utxo of utxosBCH) {
                    inputUtxos.push(Utxo.utxoToUnspentOutput(utxo));

                    if (inputUtxos.reduce((a, v) => a + v.satoshis, 0) > 5000)
                        break;
                }

                let tx = self._Helper.mintAdditional(
                    inputUtxos,
                    self.address.toString(),
                    tokenId,
                    amount
                );
                if (getFee) return tx.getFee();
                if (balance < tx.getFee())
                    return { error: true, message: "balance too small" };
                tx = tx.sign(self.privKey);
                const txid = await Utxo.broadcastTx(tx);
                return txid;
            },
            burnGroup: async function (
                tokenId: string,
                amount: number | "all",
                getFee = false
            ): Promise<Interface.Error | Interface.tx | number> {
                let utxos = await Utxo.getAddressUtxos(self.address.toString());
                if ("error" in utxos) return utxos;
                let inputUtxosSLP: Bitcore.Transaction.UnspentOutput[] = [];
                let hasSplited: Interface.Utxo[] = [];
                if (self.hasTokenInfo(utxos, 129, false, tokenId).length == 0)
                    return {
                        error: true,
                        message: "token not found in your address",
                    };
                let slpOutput: slpMdm.BN[] = [];
                if (amount == "all") {
                    const tokenToBurn = self.hasTokenInfo(
                        utxos,
                        129,
                        false,
                        tokenId
                    );
                    let totalAmount = 0;
                    for (const utxo of tokenToBurn) {
                        totalAmount += utxo.slp.amount;
                    }
                    inputUtxosSLP = inputUtxosSLP.concat(
                        tokenToBurn.map((v) => Utxo.utxoToUnspentOutput(v))
                    );
                    slpOutput = [new slpMdm.BN(totalAmount)];
                } else {
                    const tokenToBurn = self.hasTokenInfo(
                        utxos,
                        129,
                        false,
                        tokenId
                    );
                    let totalAmount = 0;
                    for (const utxo of tokenToBurn) {
                        inputUtxosSLP.push(Utxo.utxoToUnspentOutput(utxo));
                        totalAmount += utxo.slp.amount;
                        if (totalAmount >= amount) break;
                    }
                    slpOutput = [
                        new slpMdm.BN(totalAmount - amount),
                        new slpMdm.BN(amount),
                    ];
                }
                const utxoBCH = utxos.filter((v) => !v.slp);
                const balance = utxoBCH.reduce((a, v) => a + v.value, 0);
                if (balance < 546)
                    return { error: true, message: "insuffient bch balance" };
                const inputUtxosBCH = [];
                for (const utxo of utxoBCH) {
                    inputUtxosBCH.push(Utxo.utxoToUnspentOutput(utxo));
                    if (
                        inputUtxosBCH.reduce((a, v) => a + v.satoshis, 0) > 5000
                    )
                        break;
                }
                const inputUtxo = inputUtxosSLP.concat(inputUtxosBCH);
                const tx = new Bitcore.Transaction()
                    .from(inputUtxo)
                    .addOutput(
                        new Bitcore.Transaction.Output({
                            script: Bitcore.Script.fromBuffer(
                                slpMdm.NFT1.Group.send(tokenId, slpOutput)
                            ),
                            satoshis: 0,
                        })
                    )
                    .to(self.address, 546)
                    .change(self.address)
                    .feePerByte(1);
                if (getFee) return tx.getFee();

                const txid = await Utxo.broadcastTx(tx, true);
                return txid;
            },
            childGenesis: async function (data: {
                parentTokenId: string;
                name: string;
                symbol: string;
                documentUri: string;
                documentHash: string;
                autoSplit?: boolean;
                getFee?: boolean;
            }): Promise<
                | Interface.Error
                | number
                | Interface.tx
                | {
                      splitTx: Interface.tx | number | Interface.Error;
                      mintTx: Interface.tx;
                  }
            > {
                let utxos = await Utxo.getAddressUtxos(self.address.toString());
                if ("error" in utxos) return utxos;
                let utxosBCH = utxos.filter((v) => !v.slp);
                let balance = utxosBCH.reduce((a, v) => a + v.value, 0);
                let utxosSLP = self.hasTokenInfo(
                    utxos,
                    129,
                    false,
                    data.parentTokenId
                );
                const groupUtxo = utxosSLP.filter(
                    (v) => !new slpMdm.BN(v.slp.amount).eq(1)
                );
                let utxoToUse = utxosSLP.filter((v) =>
                    new slpMdm.BN(v.slp.amount).eq(1)
                );
                let split: Interface.Error | Interface.tx | number = 0;
                let doSplit = false;
                if (utxoToUse.length == 0) {
                    if (groupUtxo.length == 0)
                        return {
                            error: true,
                            message: "no usable or splitable utxos found",
                        };
                    if (data.autoSplit) {
                        doSplit = true;
                        split = await self.splitGroupUtxo(
                            data.parentTokenId,
                            data.getFee
                        );
                        if (typeof split == "number" || split.error == true)
                            return split;
                        return this.childGenesis(data);
                    } else {
                        return {
                            error: true,
                            message: "no usable utxos found",
                        };
                    }
                }
                const inputUtxos = [Utxo.utxoToUnspentOutput(utxoToUse[0])];
                for (const utxo of utxosBCH) {
                    inputUtxos.push(Utxo.utxoToUnspentOutput(utxo));
                    if (inputUtxos.reduce((a, v) => a + v.satoshis, 0) > 5000)
                        break;
                }

                const tx = new Bitcore.Transaction()
                    .from(inputUtxos)
                    .addOutput(
                        new Bitcore.Transaction.Output({
                            script: Bitcore.Script.fromBuffer(
                                slpMdm.NFT1.Child.genesis(
                                    data.symbol,
                                    data.name,
                                    data.documentUri,
                                    data.documentHash
                                )
                            ),
                            satoshis: 0,
                        })
                    )
                    .to(self.address, 546)
                    .change(self.address)
                    .feePerByte(1)
                    .sign(self.privKey);

                if (data.getFee) return tx.getFee();
                if (balance < tx.getFee())
                    return { error: true, message: "insufficient BCH balance" };

                const txid = await Utxo.broadcastTx(tx);
                if (doSplit) return { splitTx: split, mintTx: txid };
                return txid;
            },
        };
    }
    private async splitGroupUtxo(
        tokenId: string,
        getFee = false
    ): Promise<Interface.Error | Interface.tx | number> {
        const utxos = await this.data.client.getAddressUtxos(
            this.address.toString()
        );
        if ("error" in utxos) return utxos;
        const utxosBCH = utxos.filter((v) => !v.slp);
        const balance = utxosBCH.reduce((a, v) => a + v.value, 0);
        const groupUtxos = this.hasTokenInfo(utxos, 129, false, tokenId).filter(
            (v) => new slpMdm.BN(v.slp.amount).gt(1)
        );
        if (groupUtxos.length == 0) {
            return { error: true, message: "no splitable utxo found" };
        }
        const groupUtxoAmount = Number(groupUtxos[0].slp.amount);
        const inputUtxos = [
            this.data.client.utxoToUnspentOutput(groupUtxos[0]),
        ];
        for (const utxo of utxosBCH) {
            inputUtxos.push(this.data.client.utxoToUnspentOutput(utxo));
            if (
                inputUtxos.reduce(
                    (a: number, v: Bitcore.Transaction.UnspentOutput) =>
                        a + v.satoshis,
                    0
                ) > 20000
            )
                break;
        }
        const slpOutputAmounts = [];
        for (let i = 0; i < groupUtxoAmount && i < 3; ++i) {
            slpOutputAmounts.push(new slpMdm.BN(1));
        }
        if (groupUtxoAmount > 3) {
            slpOutputAmounts.push(new slpMdm.BN(groupUtxoAmount - 3));
        }
        let tx = new Bitcore.Transaction().from(inputUtxos).addOutput(
            new Bitcore.Transaction.Output({
                script: Bitcore.Script.fromBuffer(
                    slpMdm.NFT1.Group.send(tokenId, slpOutputAmounts)
                ),
                satoshis: 0,
            })
        );
        slpOutputAmounts.forEach((v) => (tx = tx.to(this.address, 546)));

        tx = tx.change(this.address).feePerByte(1).sign(this.privKey);
        if (getFee) return tx.getFee();
        if (balance < tx.getFee())
            return { error: true, message: "insufficient BCH balance" };

        const txid = await this.data.client.broadcastTx(tx);
        return txid;
    }
    private hasSplited(
        utxos: Interface.Utxo[],
        tokenId: string,
        amount: number
    ) {
        return this.hasTokenInfo(utxos, 129, false, tokenId).filter(
            (v) => v.slp.amount == amount
        );
    }
    private hasTokenInfo(
        utxos: Interface.Utxo[],
        type: 129 | 65,
        mintBaton: boolean,
        tokenId: string
    ) {
        return utxos.filter(
            (v) =>
                v.slp &&
                v.slp.tokenType === type &&
                v.slp.isMintBaton === mintBaton &&
                v.slp.address.toString() === this.address.toString() &&
                v.slp.tokenId === tokenId
        );
    }
}
