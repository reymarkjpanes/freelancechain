"use client";

import { useState, useEffect, useCallback } from "react";
import {
  StellarWalletsKit,
  WalletNetwork,
  FREIGHTER_ID,
  FreighterModule,
} from "@creit.tech/stellar-wallets-kit";

export interface WalletState {
  publicKey: string | null;
  network: string | null;
  kit: StellarWalletsKit | null;
}

interface Props {
  onWalletChange: (state: WalletState) => void;
}

let kit: StellarWalletsKit | null = null;

function getKit(): StellarWalletsKit {
  if (!kit) {
    kit = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: FREIGHTER_ID,
      modules: [new FreighterModule()],
    });
  }
  return kit;
}

export default function WalletConnect({ onWalletChange }: Props) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMainnet, setIsMainnet] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const walletKit = getKit();
      await walletKit.openModal({
        onWalletSelected: async (option) => {
          walletKit.setWallet(option.id);
          const { address } = await walletKit.getAddress();

          // Detect network from Freighter
          let detectedNetwork = "testnet";
          try {
            const { networkPassphrase } = await walletKit.getNetwork();
            detectedNetwork = networkPassphrase?.includes("Public")
              ? "mainnet"
              : "testnet";
          } catch {
            // fallback
          }

          setPublicKey(address);
          setNetwork(detectedNetwork);
          setIsMainnet(detectedNetwork === "mainnet");
          onWalletChange({ publicKey: address, network: detectedNetwork, kit: walletKit });
        },
      });
    } catch (err) {
      console.error("Wallet connection failed:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setPublicKey(null);
    setNetwork(null);
    setIsMainnet(false);
    onWalletChange({ publicKey: null, network: null, kit: null });
  };

  const truncate = (addr: string) =>
    `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  const copyAddress = async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {isMainnet && (
        <div className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg px-3 py-1.5 font-medium flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          Switch to Testnet
        </div>
      )}

      {publicKey ? (
        <div className="flex items-center gap-2">
          {/* Network badge */}
          <span className="badge bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="status-dot status-dot-active" />
            {network ?? "testnet"}
          </span>

          {/* Address pill */}
          <button
            onClick={copyAddress}
            className="font-mono text-xs text-slate-300 bg-white/[0.04] border border-white/[0.1] px-3 py-1.5 rounded-lg hover:bg-white/[0.08] transition-all duration-200 group"
            title="Click to copy full address"
          >
            {truncate(publicKey)}
            <svg className="w-3 h-3 inline-block ml-1.5 text-slate-500 group-hover:text-violet-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
            </svg>
          </button>

          {/* Disconnect */}
          <button onClick={handleDisconnect} className="btn-ghost text-slate-500 hover:text-red-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="btn-primary"
        >
          {isConnecting ? (
            <>
              <Spinner />
              Connecting…
            </>
          ) : (
            <>
              <WalletIcon />
              Connect Wallet
            </>
          )}
        </button>
      )}
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

function WalletIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}
