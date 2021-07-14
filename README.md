# Simple BCH SLP

Simple SLP is a package written in nodejs to deal with bitcoin-cash slp and bch transaction

this is my first project. and i dont have any experience in repo and clean coding. so you will found some mess here

but i am willing to clean it in the next commit

i will try my best to make this updated

btw watch bch / slp transaction is not available yet i will add it in next time if i have time😅

also the change address is send to the same address where it came from
i havent implemented the change address
because i dont know gow they works😅
for someone who knows it your all welcome to push commits😅

## Installation

```bash
npm install simple-bch-slp
```

## Functions

-   [Intializing](#initializing)
-   Wallet
    -   [Create New Wallet](#wallet-new)
    -   [Import From WIF](#wallet-wif)
    -   [Import From Seed Phrases](#wallet-seed)
-   Address
    -   [To BCH Address](#address-bch)
    -   [To SLP Address](#address-slp)
    -   [To Legacy Address](#address-legacy)
-   BCH
    -   [get balance](#bch-balance)
    -   [max amount](#bch-max)
    -   [send](#bch-send)
    -   [send all](#bch-sendall)
-   SLP
    -   [balance](#slp-balance)
    -   [parent genesis](#slp-pgen)
    -   [child genesis](#slp-cgen)
    -   [add supply](#slp-addsupply)
    -   [destroy supply](#slp-destroy-supply)
    -   [destroy mint baton](#slp-destroy-baton)
    -   [split group utxo](#slp-split)
    -   [send](#slp-send)
-   [toWIF](#toWIF)

<a name="initializing" />
#### initializing
Arguments
- grpcUrl: string *Default:* 
  - method grpc : bchd.fountainhead.cash:443
  - method grpc testnet : bchd-testnet.greyh.at:18335
  - method rest | method rest testnet : (undefined *we cant provide server for it :( but its oupensource*)
- method: "grpc" | "rest" *Default:*  grpc
- slpDbUrl: string *Default:*
  - testnet: https://slpdb-testnet.fountainhead.cash
  - mainnet: https://slpdb.fountainhead.cash
- slpSocket: string *Default:* https://bitsocket.bch.sx (not implemented)
- bchSocket: string *Default:* https://slpstream.fountainhead.cash (not implemented)
- testnet: boolean *Default:*  false

```typescript
import SIMPLESLP from "simple-bch-slp";
const Testnet = new SIMPLESLP({ testnet: true });
async function main() {
    //code here...
}
main();
```

### NOTE

-   the network depends on what you select in initialize section
-   the if block is required

<a name="wallet-new" />
#### Create new wallet
-- you cannot use this to create transaction after you create you need to import it first 😅
Arguments
- derivation path: string *Default:* m/44'/0'/0'/0/0

```typescript
const wallet1 = await Testnet.create("m/44'/245'/0'/0/0");
if ("error" in wallet1) return console.log(wallet1);
console.log(wallet1);
// {
//     seed: 'foster apology airport sadness rain rice cluster say spare light collect rural',
//     derivationPath: "m/44'/245'/0'/0/0",
//     wif: 'cSPrirsppgLbvcnGrtxYnnyuE4cPJXoESZJpeUJBqkzz6uH67NKj',
//     bch: 'bchtest:qqutew4e5l9gpxrckxn7g64xst0cv7m6yss23j5t6a',
//     slp: 'slptest:qqutew4e5l9gpxrckxn7g64xst0cv7m6yst7kfwugq',
//     legacy: 'mkgxDwkaJusXTvadSD4iieXnX3P9JQtYyv'
// }
```

<a name="wallet-wif" />
#### Import from wif
Arguments
- wif: string required

```typescript
const wallet1 = await Testnet.fromWIF(
    "cSPrirsppgLbvcnGrtxYnnyuE4cPJXoESZJpeUJBqkzz6uH67NKj"
);
if ("error" in wallet1) return console.log(wallet1);
console.log(wallet1.Address.toCash());
// bchtest:qqutew4e5l9gpxrckxn7g64xst0cv7m6yss23j5t6a
```

<a name="wallet-seed" />
#### Import from Seed phrases
Arguments
- seed: string required
- derivation path : string *Default* m/44’/0’/0’/0/0

```typescript
const wallet1 = await Testnet.fromSeed(
    "foster apology airport sadness rain rice cluster say spare light collect rural",
    "m/44'/245'/0'/0/0"
);
if ("error" in wallet1) return console.log(wallet1);
console.log(wallet1.Address.toCash());
// bchtest:qqutew4e5l9gpxrckxn7g64xst0cv7m6yss23j5t6a
```

###Address

-   #####_Note_: you need to use the variable from the import wif / seed
    <a name="address-bch" />
-   ##### Arguments
    -- qrcode: boolean _Default_ false
    -- amount: number _Default_ 0
-   #### To Bitcoincash Address

```typescript
console.log(wallet1.Address.toCash());
// bchtest:qqutew4e5l9gpxrckxn7g64xst0cv7m6yss23j5t6a
```

<a name="address-slp" />
 - #### To SLP Address
```typescript
console.log(wallet1.Address.toSlp());
// slptest:qqutew4e5l9gpxrckxn7g64xst0cv7m6yst7kfwugq
```
<a name="address-legacy" />
 - #### To Legacy Address
```typescript
console.log(wallet1.Address.toLegacy());
// mkgxDwkaJusXTvadSD4iieXnX3P9JQtYyv
```

### BCH

<a name="bch-balance" />
- #### balance
 - Argument: 
-- format: string: "satoshi" | "bch" | "bits" *Default* satoshi
 - ```typescript
console.log(await wallet1.BCH.balance("bch"));
// 0.0001
```
<a name="bch-max" />
- #### max amount to send
 - Argument: 
-- format: string: "satoshi" | "bch" | "bits" *Default* satoshi
 - ```typescript
console.log(await wallet1.BCH.maxAmount("bch"));
// 0.0001	
```

<a name="bch-send" />
- #### send
 - Argument: 
-- address: string: required
-- amount: number: required - in bch form, minimum 0.00000546 bch
-- get fee: boolean : *Default* false
 - ```typescript
console.log(
        await wallet1.BCH.send(
            "bchtest:qqqg3m66m5s2zvvwk6y4tsuh0phta8qtrcv8se9uqk",
            546
        )
    );
	// {
    //     error: false,
    //     txid: '8c555414f195799dd0977a351af3632d40e7d9d1594abe73f1151e09d9982d7f',
    //     message: ''
    // }
```

<a name="bch-sendall" />
- #### Send All
 - Argument: 
-- address: string: required
-- get fee: boolean : *Default* false
 - ```typescript
console.log(
        await wallet1.BCH.sendAll(
            "bchtest:qqqg3m66m5s2zvvwk6y4tsuh0phta8qtrcv8se9uqk"
        )
    );
	// {
    //     error: false,
    //     txid: '0209308c7366ababdec0661d0afe8b674fe4c4d2afaf0f639b06851d5fdf0912',
    //     message: ''
    // }
```

### SLP

<a name="slp-balance" />
- #### Balance
 - Argument: 
-- tokenId: string[] | "all": default "all"
 - ```typescript
console.log(await wallet1.SLP.balance());
// [
    //     {
    //       id: '132731d90ac4c88a79d55eae2ad92709b415de886329e958cf35fdd81ba34c15',
    //       amount: '1000',
    //       parentTokenId: undefined,
    //       name: 'Mainnet coin',
    //       symbol: 'MNC',
    //       documentUri: 'https://mainnet.cash',
    //       documentHash: '0000000000000000000000000000000000000000000000000000000000000000'
    //     }
    // ]
```
<a name="slp-pgen" />
- #### Parent Genesis
 - Argument: {
	 -- symbol: string: required
	 -- name: string: required
	 -- documentUri: string: required
	 -- documentHash: string: required
	 -- amount: number: required,,
	 -- getFee: boolean: *Default* false
	 -- fixedSupply: boolean *Default* false
} 
 - ```typescript
  console.log(
        await wallet1.SLP.parentGenesis({
            symbol: "SBS",
            name: "simple-bch-slp",
            documentUri: "",
            documentHash: "",
            amount: 100000,
        })
    );
	//{
  //error: false,
  //txid: '21ff93cf20d57579db47bb6598ff38732f495e0cbae51b016a5cb4f58e21fb29',
  //message: ''
//}
```

<a name="slp-cgen" />
- #### Child Genesis
 - Argument: {
	 -- parentTokenId: string: required
	 -- name: string: required
	 -- symbol: string: required
	 -- documentUri: string: required
	 -- documentHash: string: required
	 -- getFee: boolean *Default* false
	 -- autoSplit: boolean *Default* false,
} 
 - ```typescript
console.log(
        await wallet1.SLP.childGenesis({
            parentTokenId:
                "21ff93cf20d57579db47bb6598ff38732f495e0cbae51b016a5cb4f58e21fb29",
            name: "child",
            symbol: "SBS",
            documentUri: "",
            documentHash: "",
            autoSplit: true,
        })
    );
	// {
    //     splitTx: {
    //       error: false,
    //       txid: 'f28286eea3487563704407000886a8f8938afbf5ddfdfd5052c94fc7e903f6af',
    //       message: ''
    //     },
    //     mintTx: {
    //       error: false,
    //       txid: 'e387b421b2e1496e104c447a0ff7499480ada4a92f48c6cebb27bf8029bd0257',
    //       message: ''
    //     }
    // }
```

<a name="slp-addsupply" />
- #### Add Supply
 - **NOTE**: you can only use this if mint baton is in your address
 - Argument: 
	 -- parentTokenId: string: required
	 -- amount: number: required
	 -- getFee: boolean *Default* false
 - ```typescript
console.log(
        await wallet1.SLP.addSupply(
            "21ff93cf20d57579db47bb6598ff38732f495e0cbae51b016a5cb4f58e21fb29",
            1000
        )
    );
	// {
    //     error: false,
    //     txid: '7ca530d6582214192a2e5daa5851f3d51e7acac8eb19b807fa4dbb4454b51b8b',
    //     message: ''
    // }
```

<a name="slp-destroy-supply" />
- #### Destroy Supply
 - **NOTE** : split utxo tx will add to result if you dont have splited utxo.
 i add 1000 supply before so i have splited already. thats why the response are the burnTx only
 - Argument: 
	 -- tokenId: string: required
	 -- amount: number | "all": required
	 -- getFee: boolean *Default* false
 - ```typescript
console.log(
        await wallet1.SLP.burnGroup(
            "21ff93cf20d57579db47bb6598ff38732f495e0cbae51b016a5cb4f58e21fb29",
            1000
        )
    );
	// {
    //     burnTx: {
    //       error: false,
    //       txid: '62a2d9beef15f6ff75831ec7e94ea536b7e3cccc1d43700e10d4acfb5b16790c',
    //       message: ''
    //     }
    // }
```

<a name="slp-destroy-baton" />
- #### Destroy Mint Baton
 - if you destroy mint baton you will not able to add supply
 - Argument: 
	 -- tokenId: string: required

-   ```typescript
    console.log(
        await wallet1.SLP.destroyMintBaton(
            "21ff93cf20d57579db47bb6598ff38732f495e0cbae51b016a5cb4f58e21fb29"
        )
    );
    // {
    //     error: false,
    //     txid: '815250543e9214be7e6266e1ecde88b096929814daf4252c6d0d30a7aca62352',
    //     message: ''
    // }
    ```

````

<a name="slp-split" />
- #### Split Utxos
 - this function is called in destroy supply the splitTx one
 - Argument:
	 -- tokenId: string: required

 - ```typescript
console.log(
        await wallet1.SLP.splitUtxo(
            "21ff93cf20d57579db47bb6598ff38732f495e0cbae51b016a5cb4f58e21fb29",
            1000
        )
    );
	// {
    //     error: false,
    //     txid: '06a4a3bb513960f82fc4c78374a58e2e80672d3852824a214bf64fca43cb244f',
    //     message: ''
    // }
````

<a name="slp-send" />
- #### Send
 - Argument: 
	 -- address: string: required: the simpleledger:...  address
	 -- tokenId: string: required
	 -- amount: number: *Default* 1
	 -- getFee: boolean: *Default* false
 - ```typescript
 console.log(
        await wallet1.SLP.send(
            "slptest:qqqg3m66m5s2zvvwk6y4tsuh0phta8qtrchnhzltjt",
            "21ff93cf20d57579db47bb6598ff38732f495e0cbae51b016a5cb4f58e21fb29",
            100
        )
    );
	// {
    //     error: false,
    //     txid: 'edbc46c4dc43f8366076860010c5bba11153c0b3ca7dc99de5c468730a1475b3',
    //     message: ''
    // }
```

<a name="toWIF" />
- #### To WIF
```typescript
    console.log(await wallet1.toWIF());
	//cSPrirsppgLbvcnGrtxYnnyuE4cPJXoESZJpeUJBqkzz6uH67NKj
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

copy paste 😆

## License

[MIT](https://choosealicense.com/licenses/mit/)
