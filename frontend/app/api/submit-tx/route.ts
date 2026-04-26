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
      const diagEvents = sendResult.diagnosticEventsXdr ?? [];
      const errorDetail = diagEvents.length > 0
        ? diagEvents.join(". ")
        : sendResult.errorResultXdr ?? "Transaction error";
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
        // Try to extract diagnostic info
        const diagEvents = txResult.diagnosticEventsXdr ?? [];
        const errorDetail = diagEvents.length > 0
          ? diagEvents.join(". ")
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

