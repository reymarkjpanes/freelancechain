"use client";

import { useState } from "react";
import TxStatus, { TxState } from "./TxStatus";

interface Props {
  walletPublicKey: string | null;
  onJobCreated: (jobId: string, freelancer: string, amountStroops: bigint) => void;
}

export default function JobForm({ walletPublicKey, onJobCreated }: Props) {
  const [freelancer, setFreelancer] = useState("");
  const [amountXlm, setAmountXlm] = useState("");
  const [description, setDescription] = useState(""); // UI-only, not stored on-chain
  const [txState, setTxState] = useState<TxState>("idle");
  const [txError, setTxError] = useState<string | undefined>();
  const [jobId, setJobId] = useState<string | null>(null);

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

  const isDisabled = !walletPublicKey || txState === "pending" || !!jobId;

  return (
    <div className="step-card">
      <div className="flex items-center gap-3 mb-5">
        <StepBadge n={2} done={!!jobId} />
        <div>
          <h2 className="text-base font-semibold text-slate-900">Create Job</h2>
          <p className="text-sm text-slate-500">
            Define the escrow terms. The ops account registers this on-chain.
          </p>
        </div>
      </div>

      {jobId ? (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <svg className="h-5 w-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-emerald-800">Job created on-chain ✓</p>
            <p className="text-xs font-mono text-emerald-700 mt-0.5">{jobId}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Freelancer Stellar Address
            </label>
            <input
              type="text"
              placeholder="G…"
              value={freelancer}
              onChange={(e) => setFreelancer(e.target.value)}
              disabled={isDisabled}
              className="input-field font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
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
            {amountXlm && (
              <p className="text-xs text-slate-400 mt-1">
                = {Math.round(parseFloat(amountXlm || "0") * 10_000_000).toLocaleString()} stroops
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Job Description{" "}
              <span className="text-slate-400 font-normal">(UI only — not stored on-chain)</span>
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
              "Create Job"
            )}
          </button>

          {!walletPublicKey && (
            <p className="text-xs text-center text-slate-400">Connect your wallet first</p>
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
  return (
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
        ${done ? "bg-emerald-500 text-white" : "bg-violet-100 text-violet-700"}`}
    >
      {done ? "✓" : n}
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
