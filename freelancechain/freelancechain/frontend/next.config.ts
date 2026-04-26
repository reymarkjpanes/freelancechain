import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure ops secret key is never exposed to the browser bundle
  serverExternalPackages: ["@stellar/stellar-sdk"],
  env: {
    // These are PUBLIC — safe to expose to the browser
    NEXT_PUBLIC_STELLAR_NETWORK: process.env.STELLAR_NETWORK ?? "testnet",
    NEXT_PUBLIC_ESCROW_CONTRACT: process.env.ESCROW_CONTRACT_ADDRESS ?? "",
    NEXT_PUBLIC_EXPLORER_BASE: "https://stellar.expert/explorer/testnet",
  },
};

export default nextConfig;
