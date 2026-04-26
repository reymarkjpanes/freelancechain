import { NextRequest, NextResponse } from "next/server";
import {
  TransactionBuilder,
  Networks,
  SorobanRpc,
} from "@stellar/stellar-sdk";

const RPC_URL = process.env.STELLAR_RPC_URL!;

export async function POST(req: NextRequest) {
  try {
    const { signed_xdr } = await req.json();

    if (!signed_xdr) {
      return NextResponse.json({ error: "Missing signed_xdr" }, { status: 400 });
    }

    const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });

    // Reconstruct transaction from XDR
    const tx = TransactionBuilder.fromXDR(signed_xdr, Networks.TESTNET);

    const result = await server.sendTransaction(tx);

    if (result.status === "ERROR") {
      return NextResponse.json(
        { error: result.errorResult?.toString() ?? "Transaction error" },
        { status: 500 }
      );
    }

    const hash = result.hash;

    // Poll until confirmed
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const status = await server.getTransaction(hash);

      if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        return NextResponse.json({ tx_hash: hash });
      }

      if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        return NextResponse.json(
          { error: "Transaction failed on-chain" },
          { status: 500 }
        );
      }
      // NOT_FOUND = still pending, keep polling
    }

    return NextResponse.json({ error: "Transaction timed out" }, { status: 504 });
  } catch (err: any) {
    console.error("[submit-tx]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
