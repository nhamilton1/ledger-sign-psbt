import Transport from "@ledgerhq/hw-transport-webusb";
import { useState } from "react";
import { Psbt, networks } from "bitcoinjs-lib";
import AppClient, { PsbtV2, WalletPolicy } from "../../bitcoin_client_js/src";
import { resourceLimits } from "worker_threads";

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
    //bacon key
    "[9a6a2580/84'/1'/0']tpubDCMRAYcH71Gagskm7E5peNMYB5sKaLLwtn2c4Rb3CMUTRVUk5dkpsskhspa5MEcVZ11LwTcM7R5mzndUCG9WabYcT5hfQHbYVoaLFBZHPCi";
  //jeans key
  // "[12b4a70d/84'/1'/0']tpubDC6RYke2oWqmkt7UZrQiADdkT66fyJFRZMUWoHcD2W92BK6y7ZBS8oLRw6W66epPqPVisVFBnuCX214yieV2cq9jxdEYe1QJxxNoYZEi6Fb";

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
        //jeans key descriptor
        "wsh(and_v(or_c(pk(@1/**),v:older(1)),pk(@0/**)))";
      //bacon key descriptor
      // "wsh(and_v(or_c(pk(@0/**),v:older(1)),pk(@1/**)))";

      const our_key_info = `[${fingerprint}/84'/1'/0']${xpub}`;
      const keys = [our_key_info, other_key_info];

      const policy_map = new WalletPolicy(name, description_template, keys);

      const [policyId, policyHmac] = await app.registerWallet(policy_map);


      console.log(`Policy id: ${policyId.toString("hex")}`);
      console.log(`Policy hmac: ${policyHmac.toString("hex")}`);
      console.assert(policyId.compare(policy_map.getId()) == 0);

      const rawPsbtBase64: string | Buffer =
        "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";

      const rawPsbtBuffer = Buffer.from(rawPsbtBase64, "base64");

      // // Deserialize the raw PSBT
      // const psbt2 = Psbt.fromBuffer(rawPsbtBuffer, {
      //   network: networks.testnet,
      // });

      const psbtv2 = new PsbtV2();
      psbtv2.deserialize(rawPsbtBuffer);

      // const psbt = bitcoinlib_js_to_ledger(psbt2);

      if (!rawPsbtBase64) {
        console.log("Nothing to sign :(");
        setLoading(false);
        await transport.close();
        return;
      }

      // const psbt64BeforeSign = psbtv2.serialize().toString("base64");
      // setPsbtBase64BeforeSig(psbt64BeforeSign);

      const results = await app.signPsbt(psbtv2, policy_map, policyHmac);


      let ledgerpayload = Array.from(results);



      // This takes the signature result from the ledger library
      // And puts all of the responses into a list of dictionarys
      // of format:
      // {"index":index,"pubkey":pubkey,"signature":signature}
      const signatureDataList = [];
      for (const anarray of ledgerpayload) {
        const signatureData = {
          "index": anarray[0],
          "pubkey": anarray[1].toString('hex'),
          "signature": anarray[2].toString('hex')
        };
        signatureDataList.push(signatureData);
      }

      console.log(JSON.stringify(signatureDataList))

      // console.log(obj);

      // for (let i = 0; i < result.length; i++) {
      //   const a_signature = result[i]?.[2].toString("hex") ?? null;
      //   const a_pubkey = result[i]?.[1].toString("hex") ?? null;
      //   const a_index = result[i]?.[0].toString() ?? null;
      //   let ledger_payload.i = { a_pubkey: a_signature };
      // }
      // const a_signature = result[0]?.[2].toString("hex") ?? null;
      // const a_pubkey = result[0]?.[1].toString("hex") ?? null;
      // const a_index = result[0]?.[0].toString() ?? null;

      // console.log(`Index is : ${index}`);
      // console.log(`Pubkey id: ${pubkey}`);
      // console.log(`Signature id: ${signature}`);

      // const signatureBuffer = result[0]?.[2];



      // psbtv2.setInputPartialSig(0, pubkey as Buffer, signatureBuffer as Buffer);

      const psbt64 = psbtv2.serialize().toString("base64");

      setSignature(signature);
      setPsbtBase64AfterSig(psbt64);

      console.log("ledger made psbt", psbtv2);
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

//pulled this from the bitcoin channel in the ledger discord
// const bitcoinlib_js_to_ledger = (psbtv0: Psbt) => {
//   const { inputCount, outputCount } =
//     psbtv0.data.globalMap.unsignedTx.getInputOutputCounts();
//   const psbtv2 = new PsbtV2();
//   psbtv2.setGlobalInputCount(inputCount);
//   psbtv2.setGlobalOutputCount(outputCount);
//   psbtv2.deserialize(psbtv0.toBuffer());
//   psbtv2.setGlobalPsbtVersion(2);
//   psbtv2.setGlobalTxVersion(psbtv0.version);
//   psbtv0.txInputs.forEach((input) => {
//     psbtv2.setInputPreviousTxId(input.index, input.hash);
//     psbtv2.setInputSequence(input.index, input?.sequence ?? 0);
//     psbtv2.setInputOutputIndex(input.index, input.index);
//   });
//   psbtv0.txOutputs.forEach((o, i) => {
//     psbtv2.setOutputAmount(i, o.value);
//     psbtv2.setOutputScript(i, o.script);
//   });
//   return psbtv2;
// };

