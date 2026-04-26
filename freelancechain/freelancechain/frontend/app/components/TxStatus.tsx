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
    <div className="mt-4">
      {status === "pending" && (
        <div className="flex items-center gap-3 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <svg className="animate-spin h-4 w-4 text-violet-600 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span>Transaction pending… Waiting for confirmation on Stellar testnet.</span>
        </div>
      )}

      {status === "confirmed" && txHash && (
        <div className="flex items-center gap-3 text-sm bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <svg className="h-5 w-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <p className="font-medium text-emerald-800">Transaction confirmed!</p>
            <a
              href={`${EXPLORER_BASE}/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-emerald-700 hover:underline break-all"
            >
              {txHash.slice(0, 20)}…{txHash.slice(-10)} ↗
            </a>
          </div>
        </div>
      )}

      {status === "failed" && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Transaction failed</p>
              {error && (
                <p className="text-xs text-red-600 mt-1 font-mono break-all">{error}</p>
              )}
            </div>
          </div>
          {onRetry && (
            <button onClick={onRetry} className="mt-3 text-xs btn-outline py-1.5 px-3 text-red-700 border-red-300 hover:bg-red-50">
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
