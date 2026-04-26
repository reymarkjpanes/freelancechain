"use client";

import { useState, useEffect, useCallback } from "react";
import {
  StellarWalletsKit,
  WalletNetwork,
  WalletType,
  FREIGHTER_ID,
  FreighterModule,
} from "@creit-tech/stellar-wallets-kit";

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
    `${addr.slice(0, 6)}…${addr.slice(-6)}`;

  return (
    <div className="flex flex-col items-end gap-2">
      {isMainnet && (
        <div className="text-xs bg-red-100 text-red-700 border border-red-200 rounded-lg px-3 py-1.5 font-medium">
          ⚠️ You are on Mainnet. Please switch to Testnet.
        </div>
      )}

      {publicKey ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="badge bg-emerald-100 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              {network ?? "testnet"}
            </span>
            <span className="font-mono text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
              {truncate(publicKey)}
            </span>
          </div>
          <button onClick={handleDisconnect} className="btn-outline text-xs py-1.5 px-3">
            Disconnect
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
