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
    "[099a0a08/84'/1'/0']tpubDC2bnFMJeVXBHzkAXMRa27nbT1mavjEEU8YguSTzBgfpbGYDNDkj9VEXX5SeGrJKwZ4LHpHSXyjjVGoodCNy6gnG4qmmtJTHTMw8G2MFkVt";

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

      const name = "Test Miniscript wallet";
      const description_template = "wsh(and_v(v:pk(@0/**),pk(@1/**)))";

      const our_key_info = `[${fingerprint}/84'/1'/0']${xpub}`;
      const keys = [our_key_info, other_key_info];

      const policy_map = new WalletPolicy(name, description_template, keys);

      const [policyId, policyHmac] = await app.registerWallet(policy_map);

      console.log(`Policy id: ${policyId.toString("hex")}`);
      console.log(`Policy hmac: ${policyHmac.toString("hex")}`);
      console.assert(policyId.compare(policy_map.getId()) == 0);

      const rawPsbtBase64: string | Buffer =
        "cHNidP8BAFMBAAAAAcyNsrwbeS+JQDFtE8cy5gkqlVTvYCuOCVVlLTXaelEXAQAAAAD+////AVwDAAAAAAAAF6kUBRnBIpsaszQf8OTCAzpZf1+rQMmHYc8kAAABAOoCAAAAAAEBg3SoIUfy3fPDzxG+LyTKCeNJDsexAC5sIkDWhsxOetkBAAAAAP7///8CJEYIAAAAAAAWABQvS+kMSfxAQMiZ+pO3TCPNTZ5UQ+gDAAAAAAAAIgAgo8UjqAxJ/XI4WI8+KV/owvwxTaR7spegvO3ZFQSeHYYCRzBEAiBvB8vi7rdOw8KD5owM94Ij8dn2h/xk4Lr/TM+Bru0pDAIgZ30YTLkZDoShqviB3jOEdaaFOrzRjM71DM9znQln94kBIQLnvIh6f9DObva+NIbgEUeu7Z4gXbv+p7dE2klmk4oF6mHPJAABASvoAwAAAAAAACIAIKPFI6gMSf1yOFiPPilf6ML8MU2ke7KXoLzt2RUEnh2GAQVMIQMukuwdMXUzT01WNx6C0XZKTa9SNfKYd3FjWnYES9ibIKxkATKxaWghA1xDGSGBxoN5JLy7YiuAHssvPvabh3cu6N0UAhFf2ermrCIGAy6S7B0xdTNPTVY3HoLRdkpNr1I18ph3cWNadgRL2JsgGAmaCghUAACAAQAAgAAAAIAAAAAAAAAAACIGA1xDGSGBxoN5JLy7YiuAHssvPvabh3cu6N0UAhFf2ermGCJzlFVUAACAAQAAgAAAAIAAAAAAAAAAAAAA";

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

      console.log("ledger made psbt", psbt);

      debugger;
      const result = await app.signPsbt(psbt, policy_map, policyHmac, () => {
        console.log("signing input");
        return;
      });

      console.log("signatures: ", result);

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