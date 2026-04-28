import { NextRequest, NextResponse } from "next/server";
import {
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Contract,
  nativeToScVal,
  Address,
  rpc,
} from "@stellar/stellar-sdk";

const RPC_URL = process.env.STELLAR_RPC_URL!;
const CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS!;
const OPS_SECRET = process.env.OPS_ACCOUNT_SECRET_KEY!;
const TOKEN_ADDRESS = process.env.XLM_TOKEN_ADDRESS!;

/**
 * Raw JSON-RPC call to getTransaction — bypasses the SDK's XDR parser
 * which crashes on Protocol 22 transaction results ("Bad union switch: 4").
 */
async function rawGetTransaction(hash: string): Promise<{ status: string }> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: { hash },
    }),
  });
  const json = await res.json();
  return json.result ?? { status: "NOT_FOUND" };
}

// Simple in-memory rate limiter to prevent Ops account draining
// Stores IP address and an array of request timestamps
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3;

export async function POST(req: NextRequest) {
  try {
    // Basic IP Rate Limiting
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const now = Date.now();
    
    if (ip !== "unknown") {
      const timestamps = rateLimitMap.get(ip) ?? [];
      // Filter out timestamps older than the window
      const validTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
      
      if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
        console.warn(`[create-job] Rate limit exceeded for IP: ${ip}`);
        return NextResponse.json(
          { error: "Too many requests. Please wait a minute before creating another job." },
          { status: 429 }
        );
      }
      
      validTimestamps.push(now);
      rateLimitMap.set(ip, validTimestamps);
    }

    const { job_id, client_address, freelancer_address, amount_stroops } =
      await req.json();

    if (!job_id || !client_address || !freelancer_address || !amount_stroops) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const server = new rpc.Server(RPC_URL, { allowHttp: false });
    const opsKeypair = Keypair.fromSecret(OPS_SECRET);
    const opsAccount = await server.getAccount(opsKeypair.publicKey());
    const contract = new Contract(CONTRACT_ADDRESS);

    const tx = new TransactionBuilder(opsAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        contract.call(
          "create_job",
          nativeToScVal(job_id, { type: "string" }),
          new Address(client_address).toScVal(),
          new Address(freelancer_address).toScVal(),
          nativeToScVal(BigInt(amount_stroops), { type: "i128" }),
          new Address(TOKEN_ADDRESS).toScVal()
        )
      )
      .setTimeout(30)
      .build();

    // Simulate first
    const simResult = await server.simulateTransaction(tx);

    if (rpc.Api.isSimulationError(simResult)) {
      return NextResponse.json(
        { error: simResult.error },
        { status: 400 }
      );
    }

    // Assemble (attach footprint + resource fees) using v13 pattern
    const assembled = rpc.assembleTransaction(tx, simResult).build();
    assembled.sign(opsKeypair);

    const result = await server.sendTransaction(assembled);

    if (result.status === "ERROR") {
      return NextResponse.json(
        { error: result.errorResult?.toString() ?? "Transaction error" },
        { status: 500 }
      );
    }

    // Poll for confirmation using raw JSON-RPC to avoid SDK XDR parsing bug
    const hash = result.hash;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const txResult = await rawGetTransaction(hash);
      if (txResult.status === "SUCCESS") {
        return NextResponse.json({ job_id, tx_hash: hash });
      }
      if (txResult.status === "FAILED") {
        return NextResponse.json({ error: "Transaction failed on-chain" }, { status: 500 });
      }
      // NOT_FOUND = still pending, keep polling
    }

    return NextResponse.json({ error: "Transaction timed out" }, { status: 504 });
  } catch (err: any) {
    console.error("[create-job]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
