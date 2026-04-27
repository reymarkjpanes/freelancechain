"use client";

export type TxState = "idle" | "pending" | "confirmed" | "failed";

interface Props {
  status: TxState;
  txHash?: string;
  error?: string;
  onRetry?: () => void;
}

const EXPLORER_BASE = "https://stellar.expert/explorer/testnet/tx";

export default function TxStatus({ status, txHash, error, onRetry }: Props) {
  if (status === "idle") return null;

  return (
    <div className="mt-4 animate-fade-in">
      {status === "pending" && (
        <div className="glass-surface rounded-xl px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
              <svg className="animate-spin h-4 w-4 text-violet-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Processing Transaction</p>
              <p className="text-xs text-slate-500">Waiting for Stellar testnet confirmation (~3-5s)</p>
            </div>
          </div>

          {/* Progress steps */}
          <div className="space-y-2 ml-11">
            <ProgressStep label="Building transaction" done />
            <ProgressStep label="Waiting for wallet signature" done />
            <ProgressStep label="Broadcasting to Stellar network" active />
            <ProgressStep label="Confirmed on-chain" />
          </div>
        </div>
      )}

      {status === "confirmed" && txHash && (
        <div className="bg-emerald-500/[0.06] border border-emerald-500/20 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
              <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-emerald-300">Transaction confirmed</p>
              <a
                href={`${EXPLORER_BASE}/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-emerald-500/70 hover:text-emerald-400 transition-colors inline-flex items-center gap-1 mt-0.5"
              >
                {txHash.slice(0, 16)}…{txHash.slice(-8)}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      )}

      {status === "failed" && (
        <div className="bg-red-500/[0.06] border border-red-500/20 rounded-xl px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-300">Transaction failed</p>
              {error && (
                <p className="text-xs text-red-400/70 mt-1 font-mono break-all">{error}</p>
              )}
            </div>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 ml-11 text-xs btn-ghost text-red-400 hover:text-red-300 border border-red-500/20 hover:bg-red-500/10"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ProgressStep({ label, done, active }: { label: string; done?: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {done ? (
        <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : active ? (
        <svg className="animate-spin w-3.5 h-3.5 text-violet-400 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      ) : (
        <div className="w-3.5 h-3.5 rounded-full border border-white/[0.12] shrink-0" />
      )}
      <span className={`text-xs ${done ? "text-slate-400" : active ? "text-violet-300" : "text-slate-600"}`}>
        {label}
      </span>
    </div>
  );
}
