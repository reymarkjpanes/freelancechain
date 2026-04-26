"use client";

import { useState, useCallback } from "react";
import TxStatus, { TxState } from "./TxStatus";
import type { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";

interface JobState {
  status: "Open" | "Funded" | "InProgress" | "Completed" | "Cancelled";
  milestoneStatus: "Pending" | "Submitted" | "Approved";
}

interface Props {
  jobId: string;
  clientAddress: string;
  freelancerAddress: string;
  amountStroops: bigint;
  walletPublicKey: string | null;
  walletKit: StellarWalletsKit | null;
}

const MILESTONE_ID = "ms_001";

export default function EscrowFlow({
  jobId,
  clientAddress,
  freelancerAddress,
  amountStroops,
  walletPublicKey,
  walletKit,
}: Props) {
  const [jobState, setJobState] = useState<JobState>({
    status: "Open",
    milestoneStatus: "Pending",
  });
  const [txState, setTxState] = useState<TxState>("idle");
  const [txHash, setTxHash] = useState<string | undefined>();
  const [txError, setTxError] = useState<string | undefined>();
  const [activeStep, setActiveStep] = useState<string | null>(null);

  const runXdrFlow = useCallback(
    async (action: string, extraParams: Record<string, string> = {}) => {
      if (!walletKit || !walletPublicKey) return;

      setTxState("pending");
      setTxHash(undefined);
      setTxError(undefined);
      setActiveStep(action);

      try {
        // 1. Build unsigned XDR
        const params = new URLSearchParams({
          action,
          job_id: jobId,
          caller_address: walletPublicKey,
          milestone_id: MILESTONE_ID,
          amount_stroops: amountStroops.toString(),
          ...extraParams,
        });
        const buildRes = await fetch(`/api/build-xdr?${params.toString()}`);
        const buildData = await buildRes.json();
        if (!buildRes.ok) throw new Error(buildData.error ?? "Failed to build XDR");

        // 2. Wallet signs
        const { signedTxXdr } = await walletKit.signTransaction(buildData.xdr, {
          networkPassphrase: "Test SDF Network ; September 2015",
          address: walletPublicKey,
        });

        // 3. Submit signed XDR
        const submitRes = await fetch("/api/submit-tx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signed_xdr: signedTxXdr }),
        });
        const submitData = await submitRes.json();
        if (!submitRes.ok) throw new Error(submitData.error ?? "Submission failed");

        setTxHash(submitData.tx_hash);
        setTxState("confirmed");

        // 4. Refresh on-chain state
        await refreshJobState();
      } catch (err: any) {
        setTxState("failed");
        setTxError(err.message ?? "Unknown error");
      } finally {
        setActiveStep(null);
      }
    },
    [walletKit, walletPublicKey, jobId, amountStroops]
  );

  const refreshJobState = async () => {
    try {
      const res = await fetch(`/api/get-job?job_id=${encodeURIComponent(jobId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setJobState({
        status: data.status,
        milestoneStatus: data.milestone_status,
      });
    } catch {
      // non-fatal — UI already updated optimistically
    }
  };

  const steps = [
    {
      key: "fund_job",
      label: "Fund Escrow",
      description: `Lock ${(Number(amountStroops) / 1e7).toFixed(7)} XLM into the contract.`,
      actor: "Client",
      color: "blue",
      show: jobState.status === "Open",
      done: jobState.status !== "Open",
      action: () => runXdrFlow("fund_job"),
    },
    {
      key: "submit_milestone",
      label: "Submit Work",
      description: "Freelancer marks milestone as done.",
      actor: "Freelancer",
      color: "amber",
      show: jobState.status === "Funded",
      done: ["InProgress", "Completed"].includes(jobState.status),
      action: () => runXdrFlow("submit_milestone"),
    },
    {
      key: "approve_milestone",
      label: "Approve & Release",
      description: "Client approves work and releases payment to freelancer.",
      actor: "Client",
      color: "emerald",
      show: jobState.status === "InProgress",
      done: jobState.status === "Completed",
      action: () => runXdrFlow("approve_milestone"),
    },
  ];

  return (
    <div className="step-card space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-sm font-bold shrink-0">
          3
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Escrow Flow</h2>
          <p className="text-sm text-slate-500">
            Complete each step to release payment on-chain.
          </p>
        </div>
      </div>

      {/* Job summary */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 text-xs space-y-1.5 font-mono">
        <Row label="Job ID" value={jobId} />
        <Row label="Client" value={truncate(clientAddress)} />
        <Row label="Freelancer" value={truncate(freelancerAddress)} />
        <Row label="Amount" value={`${(Number(amountStroops) / 1e7).toFixed(7)} XLM`} />
        <Row label="Status" value={jobState.status} highlight />
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step) => (
          <div
            key={step.key}
            className={`rounded-xl border px-4 py-4 transition-all ${
              step.done
                ? "bg-emerald-50 border-emerald-200"
                : step.show
                ? "bg-white border-violet-200 shadow-sm"
                : "bg-slate-50 border-slate-100 opacity-60"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-slate-800">{step.label}</span>
                  <span
                    className={`badge text-xs ${
                      step.actor === "Client"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {step.actor}
                  </span>
                  {step.done && (
                    <span className="badge bg-emerald-100 text-emerald-700">✓ Done</span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{step.description}</p>
              </div>

              {step.show && (
                <button
                  onClick={step.action}
                  disabled={activeStep === step.key || txState === "pending"}
                  className="btn-primary shrink-0"
                >
                  {activeStep === step.key ? (
                    <>
                      <Spinner />
                      Signing…
                    </>
                  ) : (
                    step.label
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Completed state */}
      {jobState.status === "Completed" && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl px-5 py-4 text-center">
          <p className="text-2xl mb-1">🎉</p>
          <p className="text-sm font-semibold text-emerald-800">Payment Released!</p>
          <p className="text-xs text-emerald-600 mt-0.5">
            Funds transferred trustlessly via Stellar Soroban.
          </p>
        </div>
      )}

      <TxStatus
        status={txState}
        txHash={txHash}
        error={txError}
        onRetry={() => {
          setTxState("idle");
          setTxError(undefined);
        }}
      />
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400 w-24 shrink-0">{label}</span>
      <span className={highlight ? "font-bold text-violet-700" : "text-slate-700"}>{value}</span>
    </div>
  );
}

function truncate(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
