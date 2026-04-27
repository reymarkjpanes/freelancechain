"use client";

import { useState } from "react";
import TxStatus, { TxState } from "./TxStatus";

interface Props {
  walletPublicKey: string | null;
  onJobCreated: (jobId: string, freelancer: string, amountStroops: bigint) => void;
}

const FEE_BPS = 250; // 2.5%

export default function JobForm({ walletPublicKey, onJobCreated }: Props) {
  const [freelancer, setFreelancer] = useState("");
  const [amountXlm, setAmountXlm] = useState("");
  const [description, setDescription] = useState(""); // UI-only, not stored on-chain
  const [txState, setTxState] = useState<TxState>("idle");
  const [txError, setTxError] = useState<string | undefined>();
  const [jobId, setJobId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const parsedAmount = parseFloat(amountXlm || "0");
  const platformFee = parsedAmount * (FEE_BPS / 10000);
  const freelancerReceives = parsedAmount - platformFee;

  const handleSubmit = async () => {
    if (!walletPublicKey) return;
    if (!freelancer.trim() || !amountXlm.trim()) return;

    const amountStroops = BigInt(Math.round(parseFloat(amountXlm) * 10_000_000));
    const newJobId = `job_${Date.now()}`;

    setTxState("pending");
    setTxError(undefined);

    try {
      const res = await fetch("/api/create-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: newJobId,
          client_address: walletPublicKey,
          freelancer_address: freelancer.trim(),
          amount_stroops: amountStroops.toString(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create job");
      }

      setJobId(data.job_id);
      setTxState("confirmed");
      onJobCreated(data.job_id, freelancer.trim(), amountStroops);
    } catch (err: any) {
      setTxState("failed");
      setTxError(err.message ?? "Unknown error");
    }
  };

  const copyJobId = async () => {
    if (jobId) {
      await navigator.clipboard.writeText(jobId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isDisabled = !walletPublicKey || txState === "pending" || !!jobId;

  return (
    <div className="step-card">
      <div className="flex items-center gap-3 mb-5">
        <StepBadge n={2} done={!!jobId} />
        <div>
          <h2 className="text-base font-semibold text-white">Create Job</h2>
          <p className="text-sm text-slate-400">
            Define the escrow terms. The ops account registers this on-chain.
          </p>
        </div>
      </div>

      {jobId ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-300">Job created on-chain</p>
            </div>
          </div>

          {/* Copyable Job ID */}
          <button
            onClick={copyJobId}
            className="w-full flex items-center justify-between bg-navy-900/50 rounded-lg px-3 py-2 group hover:bg-navy-900/80 transition-colors"
          >
            <span className="text-xs font-mono text-emerald-400/80">{jobId}</span>
            <span className="text-[10px] text-slate-500 group-hover:text-emerald-400 transition-colors flex items-center gap-1">
              {copied ? (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                  Copy ID
                </>
              )}
            </span>
          </button>
          <p className="text-[11px] text-slate-500 mt-2">
            Share this Job ID with the freelancer so they can load and interact with the escrow.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Freelancer Stellar Address
            </label>
            <input
              type="text"
              placeholder="G…"
              value={freelancer}
              onChange={(e) => setFreelancer(e.target.value)}
              disabled={isDisabled}
              className="input-field font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Amount (XLM)
            </label>
            <input
              type="number"
              placeholder="e.g. 100"
              min="0.0000001"
              step="0.0000001"
              value={amountXlm}
              onChange={(e) => setAmountXlm(e.target.value)}
              disabled={isDisabled}
              className="input-field"
            />
            {parsedAmount > 0 && (
              <div className="mt-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Freelancer receives</span>
                  <span className="text-emerald-400 font-medium">{freelancerReceives.toFixed(7)} XLM</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Platform fee (2.5%)</span>
                  <span className="text-slate-400">{platformFee.toFixed(7)} XLM</span>
                </div>
                <div className="border-t border-white/[0.06] pt-1 mt-1 flex justify-between text-xs">
                  <span className="text-slate-400 font-medium">Total locked in escrow</span>
                  <span className="text-white font-semibold">{parsedAmount.toFixed(7)} XLM</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Job Description{" "}
              <span className="text-slate-500 font-normal">(UI only — not stored on-chain)</span>
            </label>
            <textarea
              placeholder="Describe the work…"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isDisabled}
              className="input-field resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={isDisabled || !freelancer.trim() || !amountXlm.trim()}
            className="btn-primary w-full"
          >
            {txState === "pending" ? (
              <>
                <Spinner />
                Creating job…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create Job
              </>
            )}
          </button>

          {!walletPublicKey && (
            <p className="text-xs text-center text-slate-500">Connect your wallet first</p>
          )}
        </div>
      )}

      <TxStatus
        status={txState}
        error={txError}
        onRetry={() => setTxState("idle")}
      />
    </div>
  );
}

function StepBadge({ n, done }: { n: number; done: boolean }) {
  if (done) {
    return (
      <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-sm font-bold shrink-0">
        ✓
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-400 flex items-center justify-center text-sm font-bold shrink-0">
      {n}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
