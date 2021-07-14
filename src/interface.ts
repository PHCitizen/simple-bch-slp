import * as Client from "./Utxo";

export interface Error {
    error: true;
    message: string;
}
export interface QrUri {
    error: false;
    url: string;
    address: string;
    amount: number;
}
export interface Utxo {
    txid: string;
    vout: number;
    value: number;
    pubkey_script: string;
    block_height: number;
    coinbase: boolean;
    slp: any;
}
export interface tx {
    error: boolean;
    txid: string;
    message: string;
}
export interface Success {
    error: false;
}
export interface NftDetails {
    id: string;
    amount: number;
    parentTokenId: string;
    name: string;
    symbol: string;
    documentUri: string;
    documentHash: string;
}
export interface dbData {
    id: string;
    name: string;
    symbol: string | null;
    documentUri: string | null;
    documentHash: string | null;
}
export interface NftData {
    symbol: string;
    name: string;
    documentUri: string;
    documentHash: string;
}
export interface mintFixedSupply {
    genesisTxId: string;
    mintBatonBurning: Error | tx;
}

export interface createInterface {
    seed: string;
    derivationPath: string;
    wif: string;
    bch: string;
    slp: string;
    legacy: string;
}

export interface Data {
    grpcUrl?: string;
    method?: "grpc" | "rest";
    slpDbUrl?: string;
    slpSocket?: string;
    bchSocket?: string;
    testnet?: boolean;
}

export interface URLs extends Data {
    grpcUrl: string;
    method: "grpc" | "rest";
    slpDbUrl: string;
    slpSocket: string;
    bchSocket: string;
    testnet: boolean;
    client: Client.GRPC | Client.REST;
}
