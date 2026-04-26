import { NextRequest, NextResponse } from "next/server";

const RPC_URL = process.env.STELLAR_RPC_URL!;

/**
 * Raw JSON-RPC helper — bypasses the SDK's XDR parser which crashes
 * on Protocol 22 transaction results ("Bad union switch: 4").
 */
async function rpcCall(method: string, params: Record<string, unknown>) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) {
    throw new Error(json.error.message ?? JSON.stringify(json.error));
  }
  return json.result;
}

/**
 * Decode the errorResultXdr from sendTransaction into a human-readable message.
 * The XDR encodes a TransactionResult with a result code as a signed 32-bit int.
 */
function decodeErrorResultXdr(base64Xdr: string): string {
  try {
    const buffer = Buffer.from(base64Xdr, "base64");
    // TransactionResult: feeCharged (int64, 8 bytes) + result code (int32, 4 bytes)
    if (buffer.length >= 12) {
      const resultCode = buffer.readInt32BE(8);
      const messages = new Map<number, string>([
        [0,   "Transaction succeeded (unexpected in error path)"],
        [-1,  "Transaction failed — one or more operations failed"],
        [-2,  "Transaction submitted too early (before valid time range)"],
        [-3,  "Transaction expired — it took too long to sign. Please try again"],
        [-4,  "Missing operation in transaction"],
        [-5,  "Bad sequence number — please refresh the page and try again"],
        [-6,  "Bad authorization — signature doesn't match the required signer"],
        [-7,  "Insufficient balance — not enough XLM in your account"],
        [-8,  "Source account not found — make sure your account is funded"],
        [-9,  "Insufficient fee"],
        [-10, "Extra signatures not allowed"],
        [-11, "Internal Stellar error"],
        [-12, "Transaction type not supported"],
        [-13, "Invalid Soroban data"],
      ]);
      return messages.get(resultCode) ?? `Unknown transaction error (code ${resultCode})`;
    }
  } catch {
    // Fall through to raw XDR
  }
  return `Transaction error: ${base64Xdr}`;
}

export async function POST(req: NextRequest) {
  try {
    const { signed_xdr } = await req.json();

    if (!signed_xdr) {
      return NextResponse.json({ error: "Missing signed_xdr" }, { status: 400 });
    }

    // Submit using raw JSON-RPC to avoid SDK XDR parsing issues
    const sendResult = await rpcCall("sendTransaction", {
      transaction: signed_xdr,
    });

    console.log("[submit-tx] sendTransaction result:", JSON.stringify(sendResult));

    if (sendResult.status === "ERROR") {
      const errorDetail = sendResult.errorResultXdr
        ? decodeErrorResultXdr(sendResult.errorResultXdr)
        : "Transaction error";
      console.error("[submit-tx] ERROR:", errorDetail);
      return NextResponse.json({ error: errorDetail }, { status: 500 });
    }

    const hash = sendResult.hash;

    // Poll until confirmed
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const txResult = await rpcCall("getTransaction", { hash });

      if (txResult.status === "SUCCESS") {
        return NextResponse.json({ tx_hash: hash });
      }

      if (txResult.status === "FAILED") {
        const errorDetail = txResult.resultXdr
          ? decodeErrorResultXdr(txResult.resultXdr)
          : "Transaction failed on-chain";
        return NextResponse.json(
          { error: errorDetail },
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

