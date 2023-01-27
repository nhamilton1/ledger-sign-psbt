Launch Instructions:
- pnpm install
- pnpm run dev

Requirements:
- A test ledger, with the latest Bitcoin Testnet app installed (Version 2.1.0)

- A Chromium based browser


Keys:
- The "Bacon" Key - BIP39 Mnemonic of "Bacon" 24 times.
- `"[9a6a2580/84'/1'/0']tpubDCMRAYcH71Gagskm7E5peNMYB5sKaLLwtn2c4Rb3CMUTRVUk5dkpsskhspa5MEcVZ11LwTcM7R5mzndUCG9WabYcT5hfQHbYVoaLFBZHPCi"`

- The "Jeans" Key - BIP 39 Mnemonic of "Jeans" 12 Times
- `"[12b4a70d/84'/1'/0']tpubDC6RYke2oWqmkt7UZrQiADdkT66fyJFRZMUWoHcD2W92BK6y7ZBS8oLRw6W66epPqPVisVFBnuCX214yieV2cq9jxdEYe1QJxxNoYZEi6Fb"`


Process:
- With an unlocked ledger, open your Bitcoin Testnet App (version 2.1.0). Load the app with the launch instructions above.
- Click Initiate Connection





Breakdown of Issue:


Here is a breakdown:

The Ledger JS library is unable to deserialize PSBTs from base64. We get 04 & 05 errors (I believe coming from the global map of total count of inputs and outputs). To get around this we are using the bitcoinjs-lib library, which can deserialize the initial PSBT in base 64. We then take this buffer that has been deserialized using bitcoinjs-lib, and pass it into the Psbtv2 class using this function:

(thanks @youfoundron for the help getting this far!)

```
const getPSBTv2Fromv0 = (psbtv0: Psbt) => {
  const { inputCount, outputCount } =
    psbtv0.data.globalMap.unsignedTx.getInputOutputCounts();
  const psbtv2 = new PsbtV2();
  psbtv2.setGlobalInputCount(inputCount);
  psbtv2.setGlobalOutputCount(outputCount);
  psbtv2.deserialize(psbtv0.toBuffer());
  psbtv2.setGlobalPsbtVersion(2);
  psbtv2.setGlobalTxVersion(psbtv0.version);
  psbtv0.txInputs.forEach((input) => {
    psbtv2.setInputPreviousTxId(input.index, input.hash);
    psbtv2.setInputSequence(input.index, input?.sequence ?? 0);
    psbtv2.setInputOutputIndex(input.index, input.index);
  });
  psbtv0.txOutputs.forEach((o, i) => {
    psbtv2.setOutputAmount(i, o.value);
    psbtv2.setOutputScript(i, o.script);
  });
  return psbtv2;
};
```

Note - to get the serialize function to work in the bitcoin_client_js library, a small edit was required in this file: bitcoin_client_js/src/lib/psbtv2.ts


Was changed
```
function serializeMap(buf: BufferWriter, map: ReadonlyMap<string, Buffer>) {
  for (const k in map.keys) {
    const value = map.get(k)!;
    const keyPair = new KeyPair(createKey(Buffer.from(k, 'hex')), value);
    keyPair.serialize(buf);
  }

```

To this:

```
function serializeMap(buf: BufferWriter, map: ReadonlyMap<string, Buffer>) {
  for (const key of map.keys()) {
    const value = map.get(key);
    const keyPair = new KeyPair(createKey(Buffer.from(key, 'hex')), value);
    keyPair.serialize(buf);
  }

```

If this change was not done, the serializing function would not work, and would only output the first characters of the psbt, like this:

```
cHNidP8AAAA=

```


When you compare PSBTs that are made with this approach, we hit one of two outcomes:

1. By default, the PSBT that is generated adds extra data in several fields, resulting in a different signature.
2. If we manually remove those fields, the ledger refuses to sign.


To show this, we are using two reference ledgers, with known seed phrases:

Keys:
The "Bacon" Key - BIP39 Mnemonic of "Bacon" 24 times.
- `"[9a6a2580/84'/1'/0']tpubDCMRAYcH71Gagskm7E5peNMYB5sKaLLwtn2c4Rb3CMUTRVUk5dkpsskhspa5MEcVZ11LwTcM7R5mzndUCG9WabYcT5hfQHbYVoaLFBZHPCi"`
The "Jeans" Key - BIP 39 Mnemonic of "Jeans" 12 Times
- `"[12b4a70d/84'/1'/0']tpubDC6RYke2oWqmkt7UZrQiADdkT66fyJFRZMUWoHcD2W92BK6y7ZBS8oLRw6W66epPqPVisVFBnuCX214yieV2cq9jxdEYe1QJxxNoYZEi6Fb"`


From here, we put them in a generic Output Descriptor using Miniscript:

`wsh(and_v(or_c(pk([9a6a2580/84'/1'/0']tpubDCMRAYcH71Gagskm7E5peNMYB5sKaLLwtn2c4Rb3CMUTRVUk5dkpsskhspa5MEcVZ11LwTcM7R5mzndUCG9WabYcT5hfQHbYVoaLFBZHPCi/0/*),v:older(5)),pk([12b4a70d/84'/1'/0']tpubDC6RYke2oWqmkt7UZrQiADdkT66fyJFRZMUWoHcD2W92BK6y7ZBS8oLRw6W66epPqPVisVFBnuCX214yieV2cq9jxdEYe1QJxxNoYZEi6Fb/0/*)))`

Here is the PSBT for testing:

```cHNidP8BAFMBAAAAAY+G1NL1n96WC88aGpxMV7Rj+l7Bp7LYZcNbSC1dnjwQAAAAAAD+////AYQmAAAAAAAAF6kUBRnBIpsaszQf8OTCAzpZf1+rQMmHR+UkAAABAP0CAQIAAAAAAQGzoox1YhaYtK64X+8r+Wx81MvbrUogsYjM0NM40d8jGgEAAAAXFgAU5VzquRhTOMekY/DDmaOJ/izmnpT9////AhAnAAAAAAAAIgAgXC0bh2RNhhRSfnFXI1iuPWDDJ5wH48yjLlp9GBg1SSptFwMAAAAAABepFDLEQFzCw7ju4cqv8Ae8uL9KTSPGhwJHMEQCICO2qmAj0hh0m2NMkYYtXne0jymhuOfSVkERJdxnr3ocAiBNA5pLqECCxSDEWmrTIfDJsgDo+7j5urg344LHW0OElwEhA5nHzjpnBXAGd9XnHfE7THtWTEU0r2B8cqN4nPfoqUEVCeUkAAEBKxAnAAAAAAAAIgAgXC0bh2RNhhRSfnFXI1iuPWDDJ5wH48yjLlp9GBg1SSoBBUshA52U/v/31tZxTnZaCxYp2L1yXTIU1TBYdSmiBsonzUiYrGRVsmloIQL6p/MNuby2llIBG9P+SLj5BKnxJdUeK+ZK8f4V1PdAiawiBgL6p/MNuby2llIBG9P+SLj5BKnxJdUeK+ZK8f4V1PdAiRgStKcNVAAAgAEAAIAAAACAAAAAAAAAAAAiBgOdlP7/99bWcU52WgsWKdi9cl0yFNUwWHUpogbKJ81ImBiaaiWAVAAAgAEAAIAAAACAAAAAAAAAAAAAAA==```


Setting it up as a wallet policy with Ledger, we have it set up like this:

`wsh(and_v(or_c(pk(@1/**),v:older(5)),pk(@0/**)))`
With the Bacon Key as @1, and the Jeans key as @0.

When put through Python, the signatured encoded in hex is:
`30440220613390698d0a636778e6285e1a24832d84ac09fffececc3b8f3fce03785df69302201f237ea9f7a15d66b27336153af5babf05cbd1376f51ca6544b700c2fefe213b01`

When put through Javascript, the signatured encoded in hex is:
`304402201e9eaee8e134a7446d0f038df93c12924409d6e8351ddf3e2805e3e69eefdc3502201321eb346d15f4169bfb29f3bf958b1d3518d428e92ce3fa2f4e3e904bb5545101`

It appears when we are porting the PSBT into the Ledger Class, there are extra fields that are being input into the PSBT causing a deviation in the signature.


When running the function above to load the PSBT into the class we get this as the unsigned PSBT:
`cHNidP8BBAEBAQUBAQEAUwEAAAABj4bU0vWf3pYLzxoanExXtGP6XsGnsthlw1tILV2ePBAAAAAAAP7///8BhCYAAAAAAAAXqRQFGcEimxqzNB/w5MIDOll/X6tAyYcJ5SQAAfsEAgAAAAECBAEAAAAAAQD9AgECAAAAAAEBs6KMdWIWmLSuuF/vK/lsfNTL261KILGIzNDTONHfIxoBAAAAFxYAFOVc6rkYUzjHpGPww5mjif4s5p6U/f///wIQJwAAAAAAACIAIFwtG4dkTYYUUn5xVyNYrj1gwyecB+PMoy5afRgYNUkqbRcDAAAAAAAXqRQyxEBcwsO47uHKr/AHvLi/Sk0jxocCRzBEAiAjtqpgI9IYdJtjTJGGLV53tI8pobjn0lZBESXcZ696HAIgTQOaS6hAgsUgxFpq0yHwybIA6Pu4+bq4N+OCx1tDhJcBIQOZx846ZwVwBnfV5x3xO0x7VkxFNK9gfHKjeJz36KlBFQnlJAABASsQJwAAAAAAACIAIFwtG4dkTYYUUn5xVyNYrj1gwyecB+PMoy5afRgYNUkqAQVLIQOdlP7/99bWcU52WgsWKdi9cl0yFNUwWHUpogbKJ81ImKxkVbJpaCEC+qfzDbm8tpZSARvT/ki4+QSp8SXVHivmSvH+FdT3QImsIgYC+qfzDbm8tpZSARvT/ki4+QSp8SXVHivmSvH+FdT3QIkYErSnDVQAAIABAACAAAAAgAAAAAAAAAAAIgYDnZT+//fW1nFOdloLFinYvXJdMhTVMFh1KaIGyifNSJgYmmolgFQAAIABAACAAAAAgAAAAAAAAAAAAQ4gj4bU0vWf3pYLzxoanExXtGP6XsGnsthlw1tILV2ePBABEAT+////AQ8EAAAAAAABAwiEJgAAAAAAAAEEF6kUBRnBIpsaszQf8OTCAzpZf1+rQMmHAA==`

After the signature, this is the new PSBT:
`cHNidP8BBAEBAQUBAQEAUwEAAAABj4bU0vWf3pYLzxoanExXtGP6XsGnsthlw1tILV2ePBAAAAAAAP7///8BhCYAAAAAAAAXqRQFGcEimxqzNB/w5MIDOll/X6tAyYcJ5SQAAfsEAgAAAAECBAEAAAAAAQD9AgECAAAAAAEBs6KMdWIWmLSuuF/vK/lsfNTL261KILGIzNDTONHfIxoBAAAAFxYAFOVc6rkYUzjHpGPww5mjif4s5p6U/f///wIQJwAAAAAAACIAIFwtG4dkTYYUUn5xVyNYrj1gwyecB+PMoy5afRgYNUkqbRcDAAAAAAAXqRQyxEBcwsO47uHKr/AHvLi/Sk0jxocCRzBEAiAjtqpgI9IYdJtjTJGGLV53tI8pobjn0lZBESXcZ696HAIgTQOaS6hAgsUgxFpq0yHwybIA6Pu4+bq4N+OCx1tDhJcBIQOZx846ZwVwBnfV5x3xO0x7VkxFNK9gfHKjeJz36KlBFQnlJAABASsQJwAAAAAAACIAIFwtG4dkTYYUUn5xVyNYrj1gwyecB+PMoy5afRgYNUkqAQVLIQOdlP7/99bWcU52WgsWKdi9cl0yFNUwWHUpogbKJ81ImKxkVbJpaCEC+qfzDbm8tpZSARvT/ki4+QSp8SXVHivmSvH+FdT3QImsIgYC+qfzDbm8tpZSARvT/ki4+QSp8SXVHivmSvH+FdT3QIkYErSnDVQAAIABAACAAAAAgAAAAAAAAAAAIgYDnZT+//fW1nFOdloLFinYvXJdMhTVMFh1KaIGyifNSJgYmmolgFQAAIABAACAAAAAgAAAAAAAAAAAAQ4gj4bU0vWf3pYLzxoanExXtGP6XsGnsthlw1tILV2ePBABEAT+////AQ8EAAAAAAABAwiEJgAAAAAAAAEEF6kUBRnBIpsaszQf8OTCAzpZf1+rQMmHAA==`


In Python, the post-signature PSBT is:

```cHNidP8BAFMBAAAAAY+G1NL1n96WC88aGpxMV7Rj+l7Bp7LYZcNbSC1dnjwQAAAAAAD+////AYQmAAAAAAAAF6kUBRnBIpsaszQf8OTCAzpZf1+rQMmHCeUkAAABAP0CAQIAAAAAAQGzoox1YhaYtK64X+8r+Wx81MvbrUogsYjM0NM40d8jGgEAAAAXFgAU5VzquRhTOMekY/DDmaOJ/izmnpT9////AhAnAAAAAAAAIgAgXC0bh2RNhhRSfnFXI1iuPWDDJ5wH48yjLlp9GBg1SSptFwMAAAAAABepFDLEQFzCw7ju4cqv8Ae8uL9KTSPGhwJHMEQCICO2qmAj0hh0m2NMkYYtXne0jymhuOfSVkERJdxnr3ocAiBNA5pLqECCxSDEWmrTIfDJsgDo+7j5urg344LHW0OElwEhA5nHzjpnBXAGd9XnHfE7THtWTEU0r2B8cqN4nPfoqUEVCeUkAAEBKxAnAAAAAAAAIgAgXC0bh2RNhhRSfnFXI1iuPWDDJ5wH48yjLlp9GBg1SSoiAgL6p/MNuby2llIBG9P+SLj5BKnxJdUeK+ZK8f4V1PdAiUcwRAIgYTOQaY0KY2d45iheGiSDLYSsCf/+zsw7jz/OA3hd9pMCIB8jfqn3oV1msnM2FTr1ur8Fy9E3b1HKZUS3AML+/iE7AQEFSyEDnZT+//fW1nFOdloLFinYvXJdMhTVMFh1KaIGyifNSJisZFWyaWghAvqn8w25vLaWUgEb0/5IuPkEqfEl1R4r5krx/hXU90CJrCIGAvqn8w25vLaWUgEb0/5IuPkEqfEl1R4r5krx/hXU90CJGBK0pw1UAACAAQAAgAAAAIAAAAAAAAAAACIGA52U/v/31tZxTnZaCxYp2L1yXTIU1TBYdSmiBsonzUiYGJpqJYBUAACAAQAAgAAAAIAAAAAAAAAAAAAA```






If you want to replicate this yourself, use this repo going through this flow. You can replicate yourself if you have a ledger running the testnet app version 2.1.0, and set the seed to a 12 word BIP 39 using only the word "jeans".


