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
    // "[3a686ab9/84'/1'/0']tpubDDAf2xGr2RqMHQwJBaYqYDr4dA3pYtgM1aCw9PeHSoUEQd9RYPKcjvZW42QT2cvNHHxa74NYcfw3jbyfZGWWwFJNWYHqXRVkp32jG2q1UjB";
    "[8e5bcd7a/84'/1'/0']tpubDD5FsPbrdeBpE6ep19fTwr5hLjzZfPigoXuDyNu5PZk1irT5myjD47AgSXALYAqX6vKp9eRW41MHGwrvCuTKJcMPVQmBVbqg1V1sbbVtzdV";

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
      // change the 1 or 0 depending on the key
      const description_template =
        "wsh(and_v(v:pk(@1/**),and_v(v:pk(@0/**),after(5))))";

      const our_key_info = `[${fingerprint}/84'/1'/0']${xpub}`;
      const keys = [our_key_info, other_key_info];

      const policy_map = new WalletPolicy(name, description_template, keys);

      const [, policyHmac] = await app.registerWallet(policy_map);

      // console.log(`Policy id: ${policyId.toString("hex")}`);
      // console.log(`Policy hmac: ${policyHmac.toString("hex")}`);
      // console.assert(policyId.compare(policy_map.getId()) == 0);

      // const policyHmac = Buffer.from(
      //   "945dad27e4a3ec009a49390ae8ba677f600fb6ad6e1608282574021170bb74e3",
      //   "hex"
      // ); //for 8e5

      const rawPsbtBase64: string | Buffer =
        "cHNidP8BBAEBAQUBAQEAUwEAAAABEObMgb07YsCg5fxWhvdmZ6EpQFJIj0tGZKbC1eqnc0AAAAAAAP7///8BteEBAAAAAAAXqRQFGcEimxqzNB/w5MIDOll/X6tAyYf35CQAAfsEAAAAAAECBAEAAAAAAQD9AgECAAAAAAEBnqv16xYNrNzFm/W1tHT9Ba0SAfwSxvjGhK+A7bJYfd8BAAAAFxYAFBXWx0wOhnPf456XDapK2IcsAWUH/f///wJA4gEAAAAAACIAIAeX7X30eiP2zOjdlKm8O8o5Y/Dkguj17X+6hD3W3LXHHyIFAAAAAAAXqRT3oWylvWAzAH9LgfNJh3O6eJYqTocCRzBEAiAEmttBfTOfhB1Haa8n8F5Y+jv5I8yXSwZAp15mZuJ0dgIgMwMF23RP1i5uE6c9YWU1791mYv++psWwtRfQkawRO88BIQJJhZB+6ol5jwhN2R1/0fBMiFb2M1NzIPOGGoqL5SJhU/fkJAABAStA4gEAAAAAACIAIAeX7X30eiP2zOjdlKm8O8o5Y/Dkguj17X+6hD3W3LXHAQVIIQPD8ISUU8P3DZH4fKcQnPjGMJVRQNbadjOceLWMXRGaPa0hApdTYuBIGsnMZb79FbMDtEJMq307wNLr72ecnkl/ZdfarVWxIgYCl1Ni4Egaycxlvv0VswO0QkyrfTvA0uvvZ5yeSX9l19oYOmhquVQAAIABAACAAAAAgAAAAAAAAAAAIgYDw/CElFPD9w2R+HynEJz4xjCVUUDW2nYznHi1jF0Rmj0YjlvNelQAAIABAACAAAAAgAAAAAAAAAAAAQ4gEObMgb07YsCg5fxWhvdmZ6EpQFJIj0tGZKbC1eqnc0ABEAT+////AQ8EAAAAACICA8PwhJRTw/cNkfh8pxCc+MYwlVFA1tp2M5x4tYxdEZo9RzBEAiAlyiPb6sOHjhmF1PF7lnk6sW7YOyyUHKCHFbT1FvIYUwIgXR+nRQwmFrcS1bmcfdfHc8Na1c6TGXKUGLrH6CGJws4BAAEDCLXhAQAAAAAAAQQXqRQFGcEimxqzNB/w5MIDOll/X6tAyYcA";

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

      psbt2.data.inputs[0]?.partialSig?.push({
        pubkey: pubkey as Buffer,
        signature: signature as Buffer,
      });

      psbt.setInputPartialSig(0, pubkey as Buffer, signature as Buffer);

      console.log(psbt.serialize().toString("base64"));

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
