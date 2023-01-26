import Transport from "@ledgerhq/hw-transport-webusb";
import { useState } from "react";
import { Psbt, networks } from "bitcoinjs-lib";
import AppClient, { PsbtV2, WalletPolicy } from "../../bitcoin_client_js/src";

const LedgerImportButton: React.FC = () => {
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
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
    "[12b4a70d/84'/1'/0']tpubDC6RYke2oWqmkt7UZrQiADdkT66fyJFRZMUWoHcD2W92BK6y7ZBS8oLRw6W66epPqPVisVFBnuCX214yieV2cq9jxdEYe1QJxxNoYZEi6Fb";

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
        "wsh(and_v(v:pk(@0/**),and_v(v:pk(@1/**),after(50))))";

      const our_key_info = `[${fingerprint}/84'/1'/0']${xpub}`;
      const keys = [our_key_info, other_key_info];

      const policy_map = new WalletPolicy(name, description_template, keys);

      const [policyId, policyHmac] = await app.registerWallet(policy_map);

      console.log(`Policy id: ${policyId.toString("hex")}`);
      console.log(`Policy hmac: ${policyHmac.toString("hex")}`);
      console.assert(policyId.compare(policy_map.getId()) == 0);

      const rawPsbtBase64: string | Buffer =
        "cHNidP8BAFMBAAAAAZ6r9esWDazcxZv1tbR0/QWtEgH8Esb4xoSvgO2yWH3fAAAAAAD+////ATNkCQAAAAAAF6kUBRnBIpsaszQf8OTCAzpZf1+rQMmH3eQkAAABAP0CAQIAAAAAAQFWX8KQgh0QkvqXoNYYEdPQvq9XXGcX2Sgm79ZK8Nk/uQEAAAAXFgAUHmqjLrEuyBL5vB1jTTKI5OD6kjf9////Ar9kCQAAAAAAIgAgUHtuaBQJ8XGM6Hth+C2B3fFUtKlF0JYxyUhkrD8QRXYQBQcAAAAAABepFDWT5u7TM5WVpWgg8SDWAy7UC5ImhwJHMEQCIHU8PA7fFrbtgBDOhC1fWyPE0gTaahs687YKjDQ6vkM7AiA/08hU4FHovuI5acLV1On+DprHZgNVxdOsC5LDdo259AEhAzAXY27FJMg1x+d3pIgLNF5DcUXBa19riXR4QDtjuA6Y3eQkAAEBK79kCQAAAAAAIgAgUHtuaBQJ8XGM6Hth+C2B3fFUtKlF0JYxyUhkrD8QRXYiAgL6p/MNuby2llIBG9P+SLj5BKnxJdUeK+ZK8f4V1PdAiUgwRQIhAMM9wxSOosdrSUOaEHASv2ZhBQl36oBDU5lFvKU/tuj0AiAV0957Lbs3ng3kiQ5aGK8j3eOOfPFWarw4F2Ze3vrayAEBBUkhA52U/v/31tZxTnZaCxYp2L1yXTIU1TBYdSmiBsonzUiYrSEC+qfzDbm8tpZSARvT/ki4+QSp8SXVHivmSvH+FdT3QImtATKxIgYC+qfzDbm8tpZSARvT/ki4+QSp8SXVHivmSvH+FdT3QIkYErSnDVQAAIABAACAAAAAgAAAAAAAAAAAIgYDnZT+//fW1nFOdloLFinYvXJdMhTVMFh1KaIGyifNSJgYmmolgFQAAIABAACAAAAAgAAAAAAAAAAAAAA=";

      const rawPsbtBuffer = Buffer.from(rawPsbtBase64, "base64");

      // Deserialize the raw PSBT
      const psbt2 = Psbt.fromBuffer(rawPsbtBuffer, {
        network: networks.testnet,
      });

      const psbt = getPSBTv2Fromv0(psbt2);

      if (!rawPsbtBase64) {
        console.log("Nothing to sign :(");
        setLoading(false);
        await transport.close();
        return;
      }

      const result = await app.signPsbt(psbt, policy_map, policyHmac);

      const pubkey = result[0]?.[1];
      const signature = result[0]?.[2];

      // psbt2.data.inputs[0]?.partialSig?.push({
      //   pubkey: pubkey as Buffer,
      //   signature: signature as Buffer,
      // });

      psbt.setInputPartialSig(0, pubkey as Buffer, signature as Buffer);
      console.log(psbt.serialize());

      setLoading(false);
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
      <div className="flex w-full flex-col">
        <p className="text-center">
          [*wallet fingerprint ID* | *derivation path*]xpub
        </p>
        <div className="w-full rounded bg-slate-900 p-5 ring-1 ring-slate-900/10">
          <div className="flex h-full max-w-xl flex-col items-center justify-center rounded bg-slate-500 md:h-24">
            {!!ledgerData.xpub && (
              <p className="max-w-md break-all">
                [{ledgerData.fingerprint}/{ledgerData.derivation_path}]
                {ledgerData.xpub}
              </p>
            )}
          </div>
        </div>
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
const getPSBTv2Fromv0 = (psbtv0: Psbt) => {
  const { inputCount, outputCount } =
    psbtv0.data.globalMap.unsignedTx.getInputOutputCounts();
  const psbtv2 = new PsbtV2();

  psbtv2.setGlobalInputCount(inputCount);
  psbtv2.setGlobalOutputCount(outputCount);

  psbtv2.deserialize(psbtv0.toBuffer());

  psbtv2.setGlobalPsbtVersion(0);
  psbtv2.setGlobalTxVersion(psbtv0.version);

  psbtv0.txInputs.forEach((input) => {
    console.log("input", input);
    console.log("input hash", input.hash.toString("hex"));
    console.log("input sequence", input.sequence);
    console.log("input index", input.index);
    psbtv2.setInputPreviousTxId(input.index, input.hash);
    psbtv2.setInputSequence(input.index, input?.sequence ?? 0);
    psbtv2.setInputOutputIndex(input.index, input.index);
  });

  psbtv0.txOutputs.forEach((o, i) => {
    console.log("output amount", o.value, "index", i);
    psbtv2.setOutputAmount(i, o.value);
    console.log("output script", o.script.toString("hex"), "index", i);
    psbtv2.setOutputScript(i, o.script);
  });
  return psbtv2;
};
