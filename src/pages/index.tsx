import { type NextPage } from "next";
import LedgerImportButton from "../features/ledger-sign-psbt";

const Home: NextPage = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-800 py-2">
      <LedgerImportButton />
    </div>
  );
};

export default Home;
