import { nativeToScVal, Address, Contract, Keypair, Networks, TransactionBuilder, BASE_FEE, rpc } from '@stellar/stellar-sdk';

console.log('SDK version:', (await import('@stellar/stellar-sdk/package.json', { assert: { type: 'json' } })).default.version);

// Test i128 encoding
const val = nativeToScVal(BigInt(100000000), { type: 'i128' });
console.log('i128 ScVal type:', val.switch().name);

// Test full transaction build
const CONTRACT_ADDRESS = 'CAC5OP6Q547MUXF7QENQT2PGJZOQDHPGXJXAPBI25NHTOGQKQXZMJBG6';
const OPS_SECRET = 'SAEIUACBLW67G5RL5JHUTB5PSRDBPJ5L7RR3JUAUUSJQQG27ZD75K4JW';
const TOKEN_ADDRESS = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const RPC_URL = 'https://soroban-testnet.stellar.org';

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
      'create_job',
      nativeToScVal('node_test_001', { type: 'string' }),
      new Address('GCOWPBOA5WNSBUBDNBY6M4XTN6OQPS5ITECIXFHKWLTVQCQ44NM7WY22').toScVal(),
      new Address('GBFRWLPYD24GMVXQS6KJD2Q2UWD7JAP7KC23JJTMUJZRT6Q4LNBWY35M').toScVal(),
      nativeToScVal(BigInt(100000000), { type: 'i128' }),
      new Address(TOKEN_ADDRESS).toScVal()
    )
  )
  .setTimeout(30)
  .build();

console.log('Transaction built OK');

const simResult = await server.simulateTransaction(tx);
console.log('Simulation result type:', simResult.constructor.name);

if (rpc.Api.isSimulationError(simResult)) {
  console.error('Simulation error:', simResult.error);
  process.exit(1);
}

const assembled = rpc.assembleTransaction(tx, simResult).build();
assembled.sign(opsKeypair);
console.log('Transaction assembled and signed OK');

const result = await server.sendTransaction(assembled);
console.log('Send result status:', result.status);
console.log('Hash:', result.hash);
