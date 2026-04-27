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
    <div className="min-h-screen relative">
      {/* Aurora Background */}
      <div className="aurora-bg">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
      </div>

      {/* Content Layer */}
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/[0.06] bg-navy-900/80 backdrop-blur-xl sticky top-0 z-20">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/25">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-bold text-white leading-tight tracking-tight">FreelanceChain</h1>
                <p className="text-[11px] text-slate-400 leading-tight">Trustless escrow on Stellar</p>
              </div>
            </div>
            <WalletConnect onWalletChange={setWallet} />
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-10 space-y-8">

          {/* Hero */}
          <section className="text-center py-6 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium mb-5">
              <span className="status-dot status-dot-active" />
              Live on Stellar Testnet
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
              No middlemen. No trust required.
            </h2>
            <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
              Client locks XLM in a Soroban smart contract. Freelancer submits work.
              Client approves — payment releases automatically on-chain.
            </p>
          </section>

          {/* How it works — 3 feature cards */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            {[
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                ),
                label: "Lock Funds",
                desc: "Client deposits XLM into escrow",
                color: "from-violet-500/20 to-violet-600/5",
                iconColor: "text-violet-400",
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.58-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                  </svg>
                ),
                label: "Submit Work",
                desc: "Freelancer marks milestone done",
                color: "from-blue-500/20 to-blue-600/5",
                iconColor: "text-blue-400",
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                  </svg>
                ),
                label: "Get Paid",
                desc: "Payment auto-releases on approval",
                color: "from-emerald-500/20 to-emerald-600/5",
                iconColor: "text-emerald-400",
              },
            ].map((step) => (
              <div key={step.label} className={`glass glass-hover p-5 text-center group cursor-default bg-gradient-to-b ${step.color}`}>
                <div className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-white/[0.06] flex items-center justify-center ${step.iconColor} group-hover:scale-110 transition-transform duration-300`}>
                  {step.icon}
                </div>
                <p className="text-sm font-semibold text-white mb-1">{step.label}</p>
                <p className="text-xs text-slate-400">{step.desc}</p>
              </div>
            ))}
          </section>

          {/* Step 1 — Wallet */}
          <div className="step-card animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <div className="flex items-center gap-3">
              <StepIndicator step={1} done={!!wallet.publicKey} active={!wallet.publicKey} />
              <div className="flex-1">
                <h2 className="text-base font-semibold text-white">Connect Wallet</h2>
                <p className="text-sm text-slate-400">
                  {wallet.publicKey
                    ? `Connected on ${wallet.network}`
                    : "Use Freighter to sign transactions"}
                </p>
              </div>
              {!wallet.publicKey && (
                <span className="text-xs text-violet-400 animate-pulse">← Start here</span>
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
                  <div className="w-8 h-8 rounded-full bg-white/[0.06] text-slate-400 flex items-center justify-center text-sm font-bold shrink-0 border border-white/[0.1]">
                    ↩
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white">Load Existing Job</h2>
                    <p className="text-sm text-slate-400">
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
                    className="flex-1 input-field font-mono text-xs"
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
                  <p className="text-xs text-red-400 mt-2">{loadError}</p>
                )}

                {!wallet.publicKey && (
                  <p className="text-xs text-slate-500 mt-2">Connect your wallet first.</p>
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
                  className="btn-ghost"
                >
                  ← Back to Create / Load Job
                </button>
              </div>
            </>
          )}

          {/* Footer */}
          <footer className="text-center text-xs text-slate-500 py-6 border-t border-white/[0.06]">
            Built on{" "}
            <a href="https://stellar.org" className="hover:text-violet-400 transition-colors" target="_blank" rel="noopener noreferrer">
              Stellar Soroban
            </a>{" "}
            · Testnet demo ·{" "}
            <a
              href="https://stellar.expert/explorer/testnet"
              className="hover:text-violet-400 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Explorer ↗
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}

/* ── Shared step indicator ──────────────────────── */
function StepIndicator({ step, done, active }: { step: number; done: boolean; active?: boolean }) {
  if (done) {
    return (
      <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-sm font-bold shrink-0">
        ✓
      </div>
    );
  }
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border
      ${active
        ? "bg-violet-500/20 border-violet-500/30 text-violet-400 animate-pulse-glow"
        : "bg-white/[0.04] border-white/[0.1] text-slate-500"
      }`}
    >
      {step}
    </div>
  );
}
