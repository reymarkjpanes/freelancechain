import { NextRequest, NextResponse } from "next/server";
import {
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Contract,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";

const RPC_URL = process.env.STELLAR_RPC_URL!;
const CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS!;
const OPS_SECRET = process.env.OPS_ACCOUNT_SECRET_KEY!;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const job_id = searchParams.get("job_id");

  if (!job_id) {
    return NextResponse.json({ error: "Missing job_id" }, { status: 400 });
  }

  try {
    const server = new rpc.Server(RPC_URL, { allowHttp: false });
    const opsKeypair = Keypair.fromSecret(OPS_SECRET);
    const opsAccount = await server.getAccount(opsKeypair.publicKey());
    const contract = new Contract(CONTRACT_ADDRESS);

    const tx = new TransactionBuilder(opsAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        contract.call("get_job", nativeToScVal(job_id, { type: "string" }))
      )
      .setTimeout(30)
      .build();

    const simulated = await server.simulateTransaction(tx);

    if (rpc.Api.isSimulationError(simulated)) {
      return NextResponse.json({ error: simulated.error }, { status: 400 });
    }

    if (
      !rpc.Api.isSimulationSuccess(simulated) ||
      !simulated.result
    ) {
      return NextResponse.json({ error: "No result from simulation" }, { status: 500 });
    }

    const raw = scValToNative(simulated.result.retval);

    // Debug: log the raw status to understand its type
    console.log("[get-job] raw.status:", typeof raw.status, raw.status);
    console.log("[get-job] raw.milestone?.status:", typeof raw.milestone?.status, raw.milestone?.status);

    // Map the contract's enum/struct return to a plain JSON shape
    const job = {
      job_id: raw.job_id,
      client: raw.client?.toString(),
      freelancer: raw.freelancer?.toString(),
      total_amount: raw.total_amount?.toString(),
      funded_amount: raw.funded_amount?.toString(),
      fee_snapshot: raw.fee_basis_points_snapshot,
      status: mapJobStatus(raw.status),
      milestone_id: raw.milestone?.milestone_id,
      milestone_amount: raw.milestone?.amount?.toString(),
      milestone_status: mapMilestoneStatus(raw.milestone?.status),
    };

    return NextResponse.json(job);
  } catch (err: any) {
    console.error("[get-job]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

const JOB_STATUS_MAP: Record<number, string> = {
  0: "Open",
  1: "Funded",
  2: "InProgress",
  3: "Completed",
  4: "Cancelled",
};

const MILESTONE_STATUS_MAP: Record<number, string> = {
  0: "Pending",
  1: "Submitted",
  2: "Approved",
};

function mapJobStatus(raw: any): string {
  // Array format from scValToNative: ['Funded']
  if (Array.isArray(raw) && raw.length > 0) {
    return String(raw[0]);
  }
  // Numeric variant index
  if (typeof raw === "number") {
    return JOB_STATUS_MAP[raw] ?? "Unknown";
  }
  // Object format: { Open: undefined }
  if (raw && typeof raw === "object") {
    const key = Object.keys(raw)[0];
    return key ?? "Unknown";
  }
  return String(raw ?? "Unknown");
}

function mapMilestoneStatus(raw: any): string {
  // Array format from scValToNative: ['Pending']
  if (Array.isArray(raw) && raw.length > 0) {
    return String(raw[0]);
  }
  // Numeric variant index
  if (typeof raw === "number") {
    return MILESTONE_STATUS_MAP[raw] ?? "Unknown";
  }
  // Object format: { Pending: undefined }
  if (raw && typeof raw === "object") {
    const key = Object.keys(raw)[0];
    return key ?? "Unknown";
  }
  return String(raw ?? "Unknown");
}

