import { NextRequest, NextResponse } from "next/server";
import {
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Contract,
  nativeToScVal,
  Address,
  SorobanRpc,
} from "@stellar/stellar-sdk";

const RPC_URL = process.env.STELLAR_RPC_URL!;
const CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS!;
const OPS_SECRET = process.env.OPS_ACCOUNT_SECRET_KEY!;

type Action = "fund_job" | "submit_milestone" | "approve_milestone";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") as Action;
  const job_id = searchParams.get("job_id") ?? "";
  const milestone_id = searchParams.get("milestone_id") ?? "ms_001";
  const caller_address = searchParams.get("caller_address") ?? "";
  const amount_stroops = searchParams.get("amount_stroops") ?? "0";

  if (!action || !job_id || !caller_address) {
    return NextResponse.json({ error: "Missing required params" }, { status: 400 });
  }

  const VALID_ACTIONS: Action[] = ["fund_job", "submit_milestone", "approve_milestone"];
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  try {
    const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });
    const opsKeypair = Keypair.fromSecret(OPS_SECRET);
    // Use caller's account for sequence — Soroban fee bump isn't needed here;
    // we build the tx with the ops account as the source (fee payer) but the
    // caller's require_auth() is satisfied by the wallet signature below.
    // For simplicity in the demo we use ops source + caller auth.
    const opsAccount = await server.getAccount(opsKeypair.publicKey());
    const contract = new Contract(CONTRACT_ADDRESS);

    let operation;

    if (action === "fund_job") {
      operation = contract.call(
        "fund_job",
        nativeToScVal(job_id, { type: "string" }),
        new Address(caller_address).toScVal(),
        nativeToScVal(BigInt(amount_stroops), { type: "i128" })
      );
    } else if (action === "submit_milestone") {
      operation = contract.call(
        "submit_milestone",
        nativeToScVal(job_id, { type: "string" }),
        nativeToScVal(milestone_id, { type: "string" }),
        new Address(caller_address).toScVal()
      );
    } else {
      // approve_milestone
      operation = contract.call(
        "approve_milestone",
        nativeToScVal(job_id, { type: "string" }),
        nativeToScVal(milestone_id, { type: "string" }),
        new Address(caller_address).toScVal()
      );
    }

    const tx = new TransactionBuilder(opsAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    // Simulate to get the footprint / resource data
    const simulated = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simulated)) {
      return NextResponse.json(
        { error: simulated.error },
        { status: 400 }
      );
    }

    const prepared = SorobanRpc.assembleTransaction(tx, simulated).build();

    return NextResponse.json({ xdr: prepared.toXDR() });
  } catch (err: any) {
    console.error("[build-xdr]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
