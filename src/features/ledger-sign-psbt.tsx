import Transport from "@ledgerhq/hw-transport-webusb";
import { useState } from "react";
import { Psbt, networks } from "bitcoinjs-lib";
import AppClient, { PsbtV2, WalletPolicy } from "../../bitcoin_client_js/src";
import { BufferReader } from "bitcoin_client_js/src/lib/buffertools";
import { sanitizeBigintToNumber } from "bitcoin_client_js/src/lib/varint";
import { pathStringToArray } from "bitcoin_client_js/src/lib/bip32";

const LedgerImportButton: React.FC = () => {
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [psbtBase64BeforeSig, setPsbtBase64BeforeSig] = useState<string | null>(
    null
  );
  const [psbtBase64AfterSig, setPsbtBase64AfterSig] = useState<string | null>(
    null
  );
  const [signature, setSignature] = useState<string | null>(null);
  const [ledgerData, setLedgerData] = useState<{
    fingerprint: string;
    derivation_path: string;
    xpub: string;
  }>({
    fingerprint: "",
    derivation_path: "",
    xpub: "",
  });

  const other_key_info =
    "[9a6a2580/84'/1'/0']tpubDCMRAYcH71Gagskm7E5peNMYB5sKaLLwtn2c4Rb3CMUTRVUk5dkpsskhspa5MEcVZ11LwTcM7R5mzndUCG9WabYcT5hfQHbYVoaLFBZHPCi";

  const handleClick = async () => {
    setLoading(true);
    setShowSuccessMessage(false);
    setErrorMessage("");
    try {
      const transport = await Transport.create();
      const app = new AppClient(transport);

      const fingerprint = await app.getMasterFingerprint();
      const derivation_path = "84'/1'/0'";
      const xpub = await app.getExtendedPubkey("m/84'/1'/0'");

      setLedgerData({
        fingerprint,
        derivation_path,
        xpub,
      });

      setShowSuccessMessage(true);

      const name = "Ledger PSBT Bounty";
      const description_template =
        "wsh(and_v(or_c(pk(@1/**),v:older(5)),pk(@0/**)))";

      const our_key_info = `[${fingerprint}/84'/1'/0']${xpub}`;
      const keys = [our_key_info, other_key_info];

      const policy_map = new WalletPolicy(name, description_template, keys);

      const [policyId, policyHmac] = await app.registerWallet(policy_map);

      console.log(`Policy id: ${policyId.toString("hex")}`);
      console.log(`Policy hmac: ${policyHmac.toString("hex")}`);
      console.assert(policyId.compare(policy_map.getId()) == 0);

      const rawPsbtBase64: string | Buffer =
        "cHNidP8BAFMBAAAAAY+G1NL1n96WC88aGpxMV7Rj+l7Bp7LYZcNbSC1dnjwQAAAAAAD+////AYQmAAAAAAAAF6kUBRnBIpsaszQf8OTCAzpZf1+rQMmHCeUkAAABAP0CAQIAAAAAAQGzoox1YhaYtK64X+8r+Wx81MvbrUogsYjM0NM40d8jGgEAAAAXFgAU5VzquRhTOMekY/DDmaOJ/izmnpT9////AhAnAAAAAAAAIgAgXC0bh2RNhhRSfnFXI1iuPWDDJ5wH48yjLlp9GBg1SSptFwMAAAAAABepFDLEQFzCw7ju4cqv8Ae8uL9KTSPGhwJHMEQCICO2qmAj0hh0m2NMkYYtXne0jymhuOfSVkERJdxnr3ocAiBNA5pLqECCxSDEWmrTIfDJsgDo+7j5urg344LHW0OElwEhA5nHzjpnBXAGd9XnHfE7THtWTEU0r2B8cqN4nPfoqUEVCeUkAAEBKxAnAAAAAAAAIgAgXC0bh2RNhhRSfnFXI1iuPWDDJ5wH48yjLlp9GBg1SSoBBUshA52U/v/31tZxTnZaCxYp2L1yXTIU1TBYdSmiBsonzUiYrGRVsmloIQL6p/MNuby2llIBG9P+SLj5BKnxJdUeK+ZK8f4V1PdAiawiBgL6p/MNuby2llIBG9P+SLj5BKnxJdUeK+ZK8f4V1PdAiRgStKcNVAAAgAEAAIAAAACAAAAAAAAAAAAiBgOdlP7/99bWcU52WgsWKdi9cl0yFNUwWHUpogbKJ81ImBiaaiWAVAAAgAEAAIAAAACAAAAAAAAAAAAAAA==";

      const rawPsbtBuffer = Buffer.from(rawPsbtBase64, "base64");

      // Deserialize the raw PSBT
      const psbt2 = Psbt.fromBuffer(rawPsbtBuffer, {
        network: networks.testnet,
      });

      const psbt = convertPsbtv0ToV2(psbt2);

      if (!rawPsbtBase64) {
        console.log("Nothing to sign :(");
        setLoading(false);
        await transport.close();
        return;
      }

      const psbt64BeforeSign = psbt.serialize().toString("base64");
      setPsbtBase64BeforeSig(psbt64BeforeSign);

      const result = await app.signPsbt(psbt, policy_map, policyHmac);

      const signature = result[0]?.[2].toString("hex") ?? null;
      const signatureBuffer = result[0]?.[2];
      const pubkey = result[0]?.[1];

      psbt.setInputPartialSig(0, pubkey as Buffer, signatureBuffer as Buffer);

      const psbt64 = psbt.serialize().toString("base64");

      setSignature(signature);
      setPsbtBase64AfterSig(psbt64);

      console.log("ledger made psbt", psbt);
      setLoading(false);
      transport.close();
    } catch (err) {
      if (err instanceof Error) {
        console.log(err);
        setLoading(false);
        if (err.message.toLocaleLowerCase().includes("unlock")) {
          setErrorMessage("Unlock your ledger.");
        } else {
          setErrorMessage(err.message);
        }
      }
    }
  };

  return (
    <div className="flex w-full max-w-4xl flex-col-reverse items-center justify-center gap-4 text-white md:flex-row md:justify-evenly md:gap-0">
      <div className="flex w-full flex-col gap-4">
        {!!ledgerData.xpub && (
          <div>
            <p className="text-center">
              [*wallet fingerprint ID* | *derivation path*]xpub
            </p>
            <div className="w-full rounded bg-slate-900 p-5 ring-1 ring-slate-900/10">
              <div className="flex h-full max-w-xl flex-col items-center justify-center rounded bg-slate-500 md:h-24">
                <p className="max-w-md break-all">
                  [{ledgerData.fingerprint}/{ledgerData.derivation_path}]
                  {ledgerData.xpub}
                </p>
              </div>
            </div>
          </div>
        )}
        {!!psbtBase64BeforeSig && (
          <div>
            <p className="text-center">
              PSBT Before Ledger Signature (Base64 Encoded)
            </p>
            <div className="w-full rounded bg-slate-900 p-5 ring-1 ring-slate-900/10">
              <div className="h-80 overflow-auto bg-slate-500 px-2">
                <p className="break-all">{psbtBase64BeforeSig}</p>
              </div>
            </div>
          </div>
        )}
        {!!signature && (
          <div>
            <p className="text-center">Signature (Hex Encoded)</p>
            <div className="w-full rounded bg-slate-900 p-5 ring-1 ring-slate-900/10">
              <div className="flex h-full flex-col items-center justify-center rounded bg-slate-500">
                <p className="max-w-md break-all">{signature}</p>
              </div>
            </div>
          </div>
        )}
        {!!psbtBase64AfterSig && (
          <div>
            <p className="text-center">
              PSBT After Ledger Signature (Base64 Encoded)
            </p>
            <div className="w-full rounded bg-slate-900 p-5 ring-1 ring-slate-900/10">
              <div className="h-80 overflow-auto bg-slate-500 px-2">
                <p className="break-all">{psbtBase64AfterSig}</p>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="flex w-full max-w-xs flex-col items-center justify-center">
        {!!errorMessage && (
          <span className="max-w-xs text-red-500">{errorMessage}</span>
        )}
        {!!showSuccessMessage && (
          <span className="text-[#16A34A]">XPub uploaded successfully!</span>
        )}
        {loading ? (
          <div className="flex flex-col justify-center">
            <div className="flex flex-row justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-slate-700"></div>
            </div>
            <span className="text-slate-700">Loading...</span>
          </div>
        ) : (
          <button
            onClick={handleClick}
            type="button"
            className=" rounded-full bg-blue-500 py-2 px-2 font-bold text-white shadow-lg transition-all hover:translate-y-1 hover:bg-blue-700"
          >
            Initiate Connection
          </button>
        )}
      </div>
    </div>
  );
};

export default LedgerImportButton;

const MAX_NSEQUENCE = 0xffffffff - 1;

export function convertPsbtv0ToV2(psbtv0: Psbt): PsbtV2 {
  const psbtv2 = new PsbtV2();
  const psbtv0GlobalMap = psbtv0.data.globalMap;

  // Set tx version and psbt version
  psbtv2.setGlobalTxVersion(1);
  psbtv2.setGlobalPsbtVersion(2);

  // Set global input / output counts
  psbtv2.setGlobalInputCount(psbtv0.data.inputs.length);
  psbtv2.setGlobalOutputCount(psbtv0.data.outputs.length);
  // Global fall back time
  psbtv2.setGlobalFallbackLocktime(0);

  // Add global xpubs
  for (const globalXpub of psbtv0GlobalMap.globalXpub ?? []) {
    psbtv2.setGlobalXpub(
      globalXpub.extendedPubkey,
      globalXpub.masterFingerprint,
      pathStringToArray(globalXpub.path)
    );
  }

  // Other unknown global properties
  for (const globalProperty of psbtv0GlobalMap.unknownKeyVals ?? []) {
    const keyLenBufferReader = new BufferReader(globalProperty.key);
    const keyLen = sanitizeBigintToNumber(keyLenBufferReader.readVarInt());
    if (keyLen == 0) {
      throw new Error("Failed to convert PSBT. Invalid key length");
    }
    const keyType = keyLenBufferReader.readUInt8();
    const keyData = keyLenBufferReader.readSlice(keyLen - 1);
    psbtv2.setGlobalUnknownKeyVal(keyType, keyData, globalProperty.value);
  }

  // Add inputs
  for (const [index, input] of psbtv0.data.inputs.entries()) {
    if (input.nonWitnessUtxo) {
      psbtv2.setInputNonWitnessUtxo(index, input.nonWitnessUtxo);
    }
    if (input.witnessUtxo) {
      // Amount is 64 bit uint LE
      const amount = Buffer.alloc(8, 0);

      // breaking here: amount.writeBigUInt64LE is not a function...
      amount.writeBigUInt64LE(BigInt(input.witnessUtxo.value));
      psbtv2.setInputWitnessUtxo(index, amount, input.witnessUtxo?.script);
    }
    if (input.redeemScript) {
      psbtv2.setInputRedeemScript(index, input.redeemScript);
    }
    if (input.witnessScript) {
      psbtv2.setInputScriptwitness(index, input.witnessScript);
    }
    if (input.bip32Derivation) {
      for (const bip32 of input.bip32Derivation) {
        psbtv2.setInputBip32Derivation(
          index,
          bip32.pubkey,
          bip32.masterFingerprint,
          pathStringToArray(bip32.path)
        );
      }
    }
  }

  // Add input nsequence, vout, and prev txid
  for (const [index, input] of psbtv0.txInputs.entries()) {
    psbtv2.setInputSequence(index, input.sequence ?? MAX_NSEQUENCE);
    psbtv2.setInputPreviousTxId(index, input.hash);
    psbtv2.setInputOutputIndex(index, input.index);
  }

  // Add output value and script
  for (const [index, output] of psbtv0.txOutputs.entries()) {
    psbtv2.setOutputAmount(index, output.value);
    psbtv2.setOutputScript(index, output.script);
  }

  for (const [index, output] of psbtv0.data.outputs.entries()) {
    if (output.bip32Derivation) {
      for (const bip32 of output.bip32Derivation) {
        psbtv2.setOutputBip32Derivation(
          index,
          bip32.pubkey,
          bip32.masterFingerprint,
          pathStringToArray(bip32.path)
        );
      }
    }
    if (output.redeemScript) {
      psbtv2.setOutputRedeemScript(index, output.redeemScript);
    }
    if (output.witnessScript) {
      psbtv2.setOutputWitnessScript(index, output.witnessScript);
    }
  }

  return psbtv2;
}
