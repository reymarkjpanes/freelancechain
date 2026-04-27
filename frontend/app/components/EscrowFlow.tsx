"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
const FEE_BPS = 250;

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
  const [loading, setLoading] = useState(true);
  const [txState, setTxState] = useState<TxState>("idle");
  const [txHash, setTxHash] = useState<string | undefined>();
  const [txError, setTxError] = useState<string | undefined>();
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Determine user role
  const isClient = walletPublicKey === clientAddress;
  const isFreelancer = walletPublicKey === freelancerAddress;
  const role = isClient ? "Client" : isFreelancer ? "Freelancer" : "Viewer";

  const amountXlm = Number(amountStroops) / 1e7;
  const platformFee = amountXlm * (FEE_BPS / 10000);
  const freelancerReceives = amountXlm - platformFee;

  // Fetch on-chain state when component mounts or jobId changes
  useEffect(() => {
    const fetchState = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/get-job?job_id=${encodeURIComponent(jobId)}`);
        if (!res.ok) return;
        const data = await res.json();
        const newStatus = data.status ?? "Open";
        setJobState({
          status: newStatus,
          milestoneStatus: data.milestone_status ?? "Pending",
        });
        if (newStatus === "Completed") setShowConfetti(true);
      } catch {
        // non-fatal — start with default state
      } finally {
        setLoading(false);
      }
    };
    fetchState();
  }, [jobId]);

  const refreshJobState = async () => {
    try {
      const res = await fetch(`/api/get-job?job_id=${encodeURIComponent(jobId)}`);
      if (!res.ok) return;
      const data = await res.json();
      const newStatus = data.status ?? "Open";
      setJobState({
        status: newStatus,
        milestoneStatus: data.milestone_status ?? "Pending",
      });
      if (newStatus === "Completed") setShowConfetti(true);
    } catch {
      // non-fatal
    }
  };

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

  const steps = [
    {
      key: "fund_job",
      label: "Fund Escrow",
      description: `Lock ${amountXlm.toFixed(7)} XLM into the contract.`,
      requiredRole: "Client" as const,
      isCurrentStep: jobState.status === "Open",
      isDone: ["Funded", "InProgress", "Completed"].includes(jobState.status),
      action: () => runXdrFlow("fund_job"),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      ),
    },
    {
      key: "submit_milestone",
      label: "Submit Work",
      description: "Freelancer marks milestone as done.",
      requiredRole: "Freelancer" as const,
      isCurrentStep: jobState.status === "Funded",
      isDone: ["InProgress", "Completed"].includes(jobState.status),
      action: () => runXdrFlow("submit_milestone"),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.58-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
        </svg>
      ),
    },
    {
      key: "approve_milestone",
      label: "Approve & Release",
      description: "Client approves work and releases payment to freelancer.",
      requiredRole: "Client" as const,
      isCurrentStep: jobState.status === "InProgress",
      isDone: jobState.status === "Completed",
      action: () => runXdrFlow("approve_milestone"),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      ),
    },
  ];

  // Can the current wallet perform the current step?
  const canAct = (step: typeof steps[0]) => {
    if (!step.isCurrentStep) return false;
    if (step.requiredRole === "Client") return isClient;
    if (step.requiredRole === "Freelancer") return isFreelancer;
    return false;
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (loading) {
    return (
      <div className="step-card text-center py-10">
        <Spinner className="w-6 h-6 text-violet-400 mx-auto" />
        <p className="text-sm text-slate-400 mt-3">Loading job state from chain…</p>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    Open: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    Funded: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    InProgress: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    Completed: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  };

  return (
    <div className="step-card space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-400 flex items-center justify-center text-sm font-bold shrink-0">
          3
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-white">Escrow Flow</h2>
          <p className="text-sm text-slate-400">
            Complete each step to release payment on-chain.
          </p>
        </div>
        {/* Role indicator */}
        <span className={`badge text-xs border ${
          isClient
            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
            : isFreelancer
            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
            : "bg-white/[0.04] text-slate-500 border-white/[0.1]"
        }`}>
          <span className={`status-dot ${isClient || isFreelancer ? "status-dot-active" : "bg-slate-600"}`} />
          You: {role}
        </span>
      </div>

      {/* ── Progress Timeline ───────────────────── */}
      <div className="relative">
        {/* Horizontal connector line (desktop) */}
        <div className="hidden md:block absolute top-6 left-[40px] right-[40px] h-[2px] bg-white/[0.06] z-0" />
        <div className="hidden md:block absolute top-6 left-[40px] h-[2px] bg-gradient-to-r from-violet-500 to-indigo-500 z-[1] transition-all duration-700"
          style={{
            width: jobState.status === "Completed" ? "100%" :
                   jobState.status === "InProgress" ? "66%" :
                   jobState.status === "Funded" ? "33%" : "0%",
            maxWidth: "calc(100% - 80px)",
          }}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 relative z-10">
          {steps.map((step, i) => {
            const isActive = step.isCurrentStep;
            const userCanAct = canAct(step);
            const wrongWallet = isActive && !userCanAct;

            return (
              <div
                key={step.key}
                className={`rounded-xl border p-4 transition-all duration-300 ${
                  step.isDone
                    ? "bg-emerald-500/[0.06] border-emerald-500/20"
                    : isActive
                    ? "bg-white/[0.04] border-violet-500/30 shadow-lg shadow-violet-500/5"
                    : "bg-white/[0.02] border-white/[0.06] opacity-50"
                }`}
              >
                {/* Step icon */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
                    step.isDone
                      ? "bg-emerald-500/20 text-emerald-400"
                      : isActive
                      ? "bg-violet-500/20 text-violet-400 animate-pulse-glow"
                      : "bg-white/[0.04] text-slate-600"
                  }`}>
                    {step.isDone ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{step.label}</span>
                      <span className={`badge text-[10px] border ${
                        step.requiredRole === "Client"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}>
                        {step.requiredRole}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mb-3">{step.description}</p>

                {/* Status badges */}
                {step.isDone && (
                  <span className="badge bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Complete
                  </span>
                )}

                {isActive && userCanAct && (
                  <>
                    <span className="badge bg-violet-500/10 text-violet-400 border border-violet-500/20 text-[10px] animate-pulse mb-3">
                      Your turn
                    </span>
                    <button
                      onClick={step.action}
                      disabled={activeStep === step.key || txState === "pending"}
                      className="btn-primary w-full text-xs py-2"
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
                  </>
                )}

                {/* Hint when wrong wallet is connected */}
                {wrongWallet && (
                  <div className="flex items-start gap-2 bg-amber-500/[0.06] border border-amber-500/15 rounded-lg px-3 py-2 mt-1">
                    <svg className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="text-[11px] text-amber-400/80">
                      Switch to the {step.requiredRole} wallet ({truncate(step.requiredRole === "Client" ? clientAddress : freelancerAddress)}) to proceed.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Job Summary Card ───────────────────── */}
      <div className="glass-surface rounded-xl px-5 py-4 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Job Details</span>
          <span className={`badge text-[10px] border ${statusColor[jobState.status] ?? "text-slate-400 bg-white/[0.04] border-white/[0.1]"}`}>
            {jobState.status}
          </span>
        </div>

        <InfoRow label="Job ID" value={jobId} onCopy={() => copyToClipboard(jobId, "jobId")} copied={copiedField === "jobId"} mono />
        <InfoRow label="Client" value={truncate(clientAddress)} fullValue={clientAddress} isYou={isClient} youColor="blue" onCopy={() => copyToClipboard(clientAddress, "client")} copied={copiedField === "client"} mono />
        <InfoRow label="Freelancer" value={truncate(freelancerAddress)} fullValue={freelancerAddress} isYou={isFreelancer} youColor="amber" onCopy={() => copyToClipboard(freelancerAddress, "freelancer")} copied={copiedField === "freelancer"} mono />

        <div className="border-t border-white/[0.06] pt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Total escrowed</span>
            <span className="text-white font-semibold">{amountXlm.toFixed(7)} XLM</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Freelancer receives</span>
            <span className="text-emerald-400">{freelancerReceives.toFixed(7)} XLM</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Platform fee (2.5%)</span>
            <span className="text-slate-400">{platformFee.toFixed(7)} XLM</span>
          </div>
        </div>
      </div>

      {/* ── Completed Celebration ───────────────── */}
      {jobState.status === "Completed" && (
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-cyan-500/10 border border-emerald-500/20 rounded-xl px-5 py-6 text-center glow-emerald">
          {/* Confetti particles */}
          {showConfetti && <ConfettiBurst />}

          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-500/20 flex items-center justify-center animate-confetti">
            <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
          </div>
          <p className="text-lg font-bold text-emerald-300 mb-1">Payment Released!</p>
          <p className="text-sm text-emerald-400/70">
            {freelancerReceives.toFixed(7)} XLM transferred trustlessly via Stellar Soroban.
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

/* ── Sub-components ──────────────────────────────── */

function InfoRow({
  label,
  value,
  fullValue,
  mono,
  isYou,
  youColor,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  fullValue?: string;
  mono?: boolean;
  isYou?: boolean;
  youColor?: "blue" | "amber";
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 group">
      <span className="text-xs text-slate-500 w-20 shrink-0">{label}</span>
      <span className={`text-xs text-slate-300 flex-1 truncate ${mono ? "font-mono" : ""}`} title={fullValue ?? value}>
        {value}
      </span>
      {isYou && (
        <span className={`badge text-[9px] border ${
          youColor === "blue"
            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
        }`}>you</span>
      )}
      {onCopy && (
        <button
          onClick={onCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-violet-400"
          title="Copy"
        >
          {copied ? (
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

function ConfettiBurst() {
  const colors = ["#10b981", "#34d399", "#6ee7b7", "#a78bfa", "#818cf8", "#fbbf24"];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="confetti-particle"
          style={{
            left: `${10 + Math.random() * 80}%`,
            top: `${Math.random() * 30}%`,
            backgroundColor: colors[i % colors.length],
            animationDelay: `${Math.random() * 0.5}s`,
            animationDuration: `${1 + Math.random()}s`,
          }}
        />
      ))}
    </div>
  );
}

function truncate(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin h-4 w-4 inline-block mr-1 ${className ?? ""}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
