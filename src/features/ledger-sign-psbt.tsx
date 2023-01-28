import Transport from "@ledgerhq/hw-transport-webusb";
import { useState } from "react";
import { Psbt, networks } from "bitcoinjs-lib";
import AppClient, { PsbtV2, WalletPolicy } from "../../bitcoin_client_js/src";

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

  // const other_key_info =
  //   "[9a6a2580/84'/1'/0']tpubDCMRAYcH71Gagskm7E5peNMYB5sKaLLwtn2c4Rb3CMUTRVUk5dkpsskhspa5MEcVZ11LwTcM7R5mzndUCG9WabYcT5hfQHbYVoaLFBZHPCi";

  const other_key_info =
    "[3a686ab9/84'/1'/0']tpubDDAf2xGr2RqMHQwJBaYqYDr4dA3pYtgM1aCw9PeHSoUEQd9RYPKcjvZW42QT2cvNHHxa74NYcfw3jbyfZGWWwFJNWYHqXRVkp32jG2q1UjB";
  // "[8e5bcd7a/84'/1'/0']tpubDD5FsPbrdeBpE6ep19fTwr5hLjzZfPigoXuDyNu5PZk1irT5myjD47AgSXALYAqX6vKp9eRW41MHGwrvCuTKJcMPVQmBVbqg1V1sbbVtzdV";

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

      //signing with 8e5
      const description_template =
        "wsh(and_v(v:pk(@0/**),and_v(v:pk(@1/**),after(5))))"; // signing with 8e5

      // const our_key_info = `[${fingerprint}/84'/1'/0']${xpub}`;
      // const keys = [our_key_info, other_key_info];

      const keys = [
        "[8e5bcd7a/84'/1'/0']tpubDD5FsPbrdeBpE6ep19fTwr5hLjzZfPigoXuDyNu5PZk1irT5myjD47AgSXALYAqX6vKp9eRW41MHGwrvCuTKJcMPVQmBVbqg1V1sbbVtzdV",
        "[3a686ab9/84'/1'/0']tpubDDAf2xGr2RqMHQwJBaYqYDr4dA3pYtgM1aCw9PeHSoUEQd9RYPKcjvZW42QT2cvNHHxa74NYcfw3jbyfZGWWwFJNWYHqXRVkp32jG2q1UjB",
      ];

      const policy_map = new WalletPolicy(name, description_template, keys);

      // const [policyId, policyHmac] = await app.registerWallet(policy_map);

      // console.log(`Policy id: ${policyId.toString("hex")}`);
      // console.log(`Policy hmac: ${policyHmac.toString("hex")}`);
      // console.assert(policyId.compare(policy_map.getId()) == 0);

      const policyHmac = Buffer.from(
        "945dad27e4a3ec009a49390ae8ba677f600fb6ad6e1608282574021170bb74e3",
        "hex"
      ); //for 8e5

      const rawPsbtBase64: string | Buffer =
        "cHNidP8BAFMBAAAAARDmzIG9O2LAoOX8Vob3ZmehKUBSSI9LRmSmwtXqp3NAAAAAAAD+////AbXhAQAAAAAAF6kUBRnBIpsaszQf8OTCAzpZf1+rQMmH9+QkAAABAP0CAQIAAAAAAQGeq/XrFg2s3MWb9bW0dP0FrRIB/BLG+MaEr4Dtslh93wEAAAAXFgAUFdbHTA6Gc9/jnpcNqkrYhywBZQf9////AkDiAQAAAAAAIgAgB5ftffR6I/bM6N2Uqbw7yjlj8OSC6PXtf7qEPdbctccfIgUAAAAAABepFPehbKW9YDMAf0uB80mHc7p4lipOhwJHMEQCIASa20F9M5+EHUdpryfwXlj6O/kjzJdLBkCnXmZm4nR2AiAzAwXbdE/WLm4Tpz1hZTXv3WZi/76mxbC1F9CRrBE7zwEhAkmFkH7qiXmPCE3ZHX/R8EyIVvYzU3Mg84YaiovlImFT9+QkAAEBK0DiAQAAAAAAIgAgB5ftffR6I/bM6N2Uqbw7yjlj8OSC6PXtf7qEPdbctccBBUghA8PwhJRTw/cNkfh8pxCc+MYwlVFA1tp2M5x4tYxdEZo9rSECl1Ni4Egaycxlvv0VswO0QkyrfTvA0uvvZ5yeSX9l19qtVbEiBgKXU2LgSBrJzGW+/RWzA7RCTKt9O8DS6+9nnJ5Jf2XX2hg6aGq5VAAAgAEAAIAAAACAAAAAAAAAAAAiBgPD8ISUU8P3DZH4fKcQnPjGMJVRQNbadjOceLWMXRGaPRiOW816VAAAgAEAAIAAAACAAAAAAAAAAAAAAA==";

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

//pulled this from the bitcoin channel in the ledger discord
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

// psbt for 3a6 and 8e5
// cHNidP8BAFMBAAAAARDmzIG9O2LAoOX8Vob3ZmehKUBSSI9LRmSmwtXqp3NAAAAAAAD+////AbXhAQAAAAAAF6kUBRnBIpsaszQf8OTCAzpZf1+rQMmH9+QkAAABAP0CAQIAAAAAAQGeq/XrFg2s3MWb9bW0dP0FrRIB/BLG+MaEr4Dtslh93wEAAAAXFgAUFdbHTA6Gc9/jnpcNqkrYhywBZQf9////AkDiAQAAAAAAIgAgB5ftffR6I/bM6N2Uqbw7yjlj8OSC6PXtf7qEPdbctccfIgUAAAAAABepFPehbKW9YDMAf0uB80mHc7p4lipOhwJHMEQCIASa20F9M5+EHUdpryfwXlj6O/kjzJdLBkCnXmZm4nR2AiAzAwXbdE/WLm4Tpz1hZTXv3WZi/76mxbC1F9CRrBE7zwEhAkmFkH7qiXmPCE3ZHX/R8EyIVvYzU3Mg84YaiovlImFT9+QkAAEBK0DiAQAAAAAAIgAgB5ftffR6I/bM6N2Uqbw7yjlj8OSC6PXtf7qEPdbctccBBUghA8PwhJRTw/cNkfh8pxCc+MYwlVFA1tp2M5x4tYxdEZo9rSECl1Ni4Egaycxlvv0VswO0QkyrfTvA0uvvZ5yeSX9l19qtVbEiBgKXU2LgSBrJzGW+/RWzA7RCTKt9O8DS6+9nnJ5Jf2XX2hg6aGq5VAAAgAEAAIAAAACAAAAAAAAAAAAiBgPD8ISUU8P3DZH4fKcQnPjGMJVRQNbadjOceLWMXRGaPRiOW816VAAAgAEAAIAAAACAAAAAAAAAAAAAAA==

// psbt for bacon and jeans
// cHNidP8BAFMBAAAAAY+G1NL1n96WC88aGpxMV7Rj+l7Bp7LYZcNbSC1dnjwQAAAAAAD+////AYQmAAAAAAAAF6kUBRnBIpsaszQf8OTCAzpZf1+rQMmHCeUkAAABAP0CAQIAAAAAAQGzoox1YhaYtK64X+8r+Wx81MvbrUogsYjM0NM40d8jGgEAAAAXFgAU5VzquRhTOMekY/DDmaOJ/izmnpT9////AhAnAAAAAAAAIgAgXC0bh2RNhhRSfnFXI1iuPWDDJ5wH48yjLlp9GBg1SSptFwMAAAAAABepFDLEQFzCw7ju4cqv8Ae8uL9KTSPGhwJHMEQCICO2qmAj0hh0m2NMkYYtXne0jymhuOfSVkERJdxnr3ocAiBNA5pLqECCxSDEWmrTIfDJsgDo+7j5urg344LHW0OElwEhA5nHzjpnBXAGd9XnHfE7THtWTEU0r2B8cqN4nPfoqUEVCeUkAAEBKxAnAAAAAAAAIgAgXC0bh2RNhhRSfnFXI1iuPWDDJ5wH48yjLlp9GBg1SSoBBUshA52U/v/31tZxTnZaCxYp2L1yXTIU1TBYdSmiBsonzUiYrGRVsmloIQL6p/MNuby2llIBG9P+SLj5BKnxJdUeK+ZK8f4V1PdAiawiBgL6p/MNuby2llIBG9P+SLj5BKnxJdUeK+ZK8f4V1PdAiRgStKcNVAAAgAEAAIAAAACAAAAAAAAAAAAiBgOdlP7/99bWcU52WgsWKdi9cl0yFNUwWHUpogbKJ81ImBiaaiWAVAAAgAEAAIAAAACAAAAAAAAAAAAAAA==
