"use client";

import { useState } from "react";
import WalletConnect, { WalletState } from "./components/WalletConnect";
import JobForm from "./components/JobForm";
import EscrowFlow from "./components/EscrowFlow";

export default function Home() {
  const [wallet, setWallet] = useState<WalletState>({
    publicKey: null,
    network: null,
    kit: null,
  });

  const [job, setJob] = useState<{
    jobId: string;
    client: string;
    freelancer: string;
    amountStroops: bigint;
  } | null>(null);

  // --- Load existing job by ID ---
  const [loadJobId, setLoadJobId] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadLoading, setLoadLoading] = useState(false);

  const handleJobCreated = (
    jobId: string,
    freelancer: string,
    amountStroops: bigint
  ) => {
    setJob({ jobId, client: wallet.publicKey!, freelancer, amountStroops });
  };

  const handleLoadJob = async () => {
    if (!loadJobId.trim()) return;
    setLoadError(null);
    setLoadLoading(true);
    try {
      const res = await fetch(`/api/get-job?job_id=${encodeURIComponent(loadJobId.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Job not found");

      setJob({
        jobId: loadJobId.trim(),
        client: data.client,
        freelancer: data.freelancer,
        amountStroops: BigInt(data.total_amount),
      });
    } catch (err: any) {
      setLoadError(err.message ?? "Failed to load job");
    } finally {
      setLoadLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">FreelanceChain</h1>
              <p className="text-xs text-slate-400 leading-tight">Trustless escrow on Stellar</p>
            </div>
          </div>
          <WalletConnect onWalletChange={setWallet} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">

        {/* Hero */}
        <section className="text-center py-4">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            No middlemen. No trust required.
          </h2>
          <p className="text-slate-500 text-sm max-w-lg mx-auto">
            Client locks XLM in a Soroban smart contract. Freelancer submits work.
            Client approves — payment releases automatically on-chain.
          </p>
        </section>

        {/* How it works */}
        <section className="grid grid-cols-3 gap-4 text-center">
          {[
            { icon: "🔒", label: "Lock Funds", desc: "Client deposits XLM into escrow" },
            { icon: "🚀", label: "Submit Work", desc: "Freelancer marks milestone done" },
            { icon: "💸", label: "Get Paid", desc: "Payment auto-releases on approval" },
          ].map((step) => (
            <div key={step.label} className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="text-2xl mb-2">{step.icon}</div>
              <p className="text-sm font-semibold text-slate-800">{step.label}</p>
              <p className="text-xs text-slate-400 mt-1">{step.desc}</p>
            </div>
          ))}
        </section>

        {/* Step 1 — Wallet */}
        <div className="step-card">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                ${wallet.publicKey ? "bg-emerald-500 text-white" : "bg-violet-100 text-violet-700"}`}
            >
              {wallet.publicKey ? "✓" : "1"}
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-slate-900">Connect Wallet</h2>
              <p className="text-sm text-slate-500">
                {wallet.publicKey
                  ? `Connected on ${wallet.network}`
                  : "Use Freighter to sign transactions"}
              </p>
            </div>
            {!wallet.publicKey && (
              <span className="text-xs text-slate-400">← Start here</span>
            )}
          </div>
        </div>

        {/* Step 2 — Create Job OR Load Existing Job */}
        {!job && (
          <>
            <JobForm
              walletPublicKey={wallet.publicKey}
              onJobCreated={handleJobCreated}
            />

            {/* Load Existing Job */}
            <div className="step-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-bold shrink-0">
                  ↩
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Load Existing Job</h2>
                  <p className="text-sm text-slate-500">
                    Enter a Job ID to resume an existing escrow flow.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. job_1777222048075"
                  value={loadJobId}
                  onChange={(e) => setLoadJobId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLoadJob()}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
                  disabled={!wallet.publicKey}
                />
                <button
                  onClick={handleLoadJob}
                  disabled={!wallet.publicKey || !loadJobId.trim() || loadLoading}
                  className="btn-primary shrink-0"
                >
                  {loadLoading ? "Loading…" : "Load Job"}
                </button>
              </div>

              {loadError && (
                <p className="text-xs text-red-500 mt-2">{loadError}</p>
              )}

              {!wallet.publicKey && (
                <p className="text-xs text-slate-400 mt-2">Connect your wallet first.</p>
              )}
            </div>
          </>
        )}

        {/* Step 3 — Escrow Flow (shown after job created or loaded) */}
        {job && wallet.publicKey && (
          <>
            <EscrowFlow
              jobId={job.jobId}
              clientAddress={job.client}
              freelancerAddress={job.freelancer}
              amountStroops={job.amountStroops}
              walletPublicKey={wallet.publicKey}
              walletKit={wallet.kit}
            />

            {/* Button to go back and create/load another job */}
            <div className="text-center">
              <button
                onClick={() => setJob(null)}
                className="text-xs text-slate-400 hover:text-violet-600 underline transition-colors"
              >
                ← Back to Create / Load Job
              </button>
            </div>
          </>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-slate-400 py-4 border-t border-slate-100">
          Built on{" "}
          <a href="https://stellar.org" className="hover:underline text-violet-500" target="_blank" rel="noopener noreferrer">
            Stellar Soroban
          </a>{" "}
          · Testnet demo ·{" "}
          <a
            href="https://stellar.expert/explorer/testnet"
            className="hover:underline text-violet-500"
            target="_blank"
            rel="noopener noreferrer"
          >
            Explorer ↗
          </a>
        </footer>
      </main>
    </div>
  );
}

