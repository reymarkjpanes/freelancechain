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
  xdr,
} from "@stellar/stellar-sdk";

const RPC_URL = process.env.STELLAR_RPC_URL!;
const CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS!;
const OPS_SECRET = process.env.OPS_ACCOUNT_SECRET_KEY!;
const TOKEN_ADDRESS = process.env.XLM_TOKEN_ADDRESS!;

export async function POST(req: NextRequest) {
  try {
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

    // Poll for confirmation
    const hash = result.hash;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const status = await server.getTransaction(hash);
      if (status.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        return NextResponse.json({ job_id, tx_hash: hash });
      }
      if (status.status === rpc.Api.GetTransactionStatus.FAILED) {
        return NextResponse.json({ error: "Transaction failed on-chain" }, { status: 500 });
      }
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
