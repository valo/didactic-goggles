import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, verifyMessage } from 'viem';
import { parseAbi } from 'viem';
import { pool } from '@/lib/server/db';
import type { RfqRow } from '@/lib/server/types';

type IncomingRfq = {
  rfqId: string;
  borrower: string;
  debtToken: string;
  collateralToken: string;
  principal: string;
  repaymentAmount: string;
  minCollateralAmount: string;
  expiry: string;
  callStrike: string;
  putStrike: string;
  oracleAdapter: string;
  oracleData: string;
  refiData: string;
  metadata?: Record<string, unknown>;
  rfqSignature: string;
};

const requiredFields: Array<keyof IncomingRfq> = [
  'rfqId',
  'borrower',
  'debtToken',
  'collateralToken',
  'principal',
  'repaymentAmount',
  'minCollateralAmount',
  'expiry',
  'callStrike',
  'putStrike',
  'oracleAdapter',
  'oracleData',
  'refiData',
  'rfqSignature'
];

const RPC_URL = process.env.API_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || '';
const MAX_RFQS_PER_BORROWER = Number(process.env.RFQ_MAX_OPEN_PER_BORROWER || '5');
const erc20Abi = parseAbi(['function balanceOf(address) view returns (uint256)']);

function publicClient() {
  if (!RPC_URL) {
    throw new Error('API_RPC_URL or NEXT_PUBLIC_RPC_URL is required for collateral checks');
  }
  return createPublicClient({ transport: http(RPC_URL) });
}

export async function POST(req: NextRequest) {
  let body: IncomingRfq;
  try {
    body = (await req.json()) as IncomingRfq;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const missing = requiredFields.filter((f) => !body[f]);
  if (missing.length) {
    return NextResponse.json({ error: `Missing fields: ${missing.join(', ')}` }, { status: 400 });
  }

  if (!RPC_URL) {
    return NextResponse.json({ error: 'RPC URL not configured on server' }, { status: 500 });
  }

  // Signature over rfqId (bytes32) using personal_sign
  try {
    const validSig = await verifyMessage({
      address: body.borrower as `0x${string}`,
      message: body.rfqId,
      signature: body.rfqSignature as `0x${string}`
    });
    if (!validSig) {
      return NextResponse.json({ error: 'Invalid borrower signature' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid borrower signature' }, { status: 400 });
  }

  // Collateral balance check
  try {
    const client = publicClient();
    const balance = await client.readContract({
      address: body.collateralToken as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [body.borrower as `0x${string}`]
    });
    if (balance < BigInt(body.minCollateralAmount)) {
      return NextResponse.json({ error: 'Insufficient collateral balance' }, { status: 400 });
    }
  } catch (err) {
    console.error('collateral check error', err);
    return NextResponse.json({ error: 'Failed to verify collateral balance' }, { status: 500 });
  }

  // Max open RFQs per borrower
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const countRes = await pool.query<{ count: string }>(
      'select count(*)::int as count from rfqs where borrower = $1 and expiry::bigint > $2',
      [body.borrower, nowSec]
    );
    const count = Number(countRes.rows[0]?.count || 0);
    if (count >= MAX_RFQS_PER_BORROWER) {
      return NextResponse.json({ error: 'RFQ limit reached for borrower' }, { status: 400 });
    }
  } catch (err) {
    console.error('rfq limit error', err);
    return NextResponse.json({ error: 'Failed to enforce RFQ limit' }, { status: 500 });
  }

  const text = `
    insert into rfqs (
      rfq_id,
      borrower,
      debt_token,
      collateral_token,
      principal,
      repayment_amount,
      min_collateral_amount,
      expiry,
      call_strike,
      put_strike,
      oracle_adapter,
      oracle_data,
      refi_data,
      metadata,
      borrower_signature
    )
    values (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
    )
    on conflict (rfq_id) do update set
      borrower = excluded.borrower,
      debt_token = excluded.debt_token,
      collateral_token = excluded.collateral_token,
      principal = excluded.principal,
      repayment_amount = excluded.repayment_amount,
      min_collateral_amount = excluded.min_collateral_amount,
      expiry = excluded.expiry,
      call_strike = excluded.call_strike,
      put_strike = excluded.put_strike,
      oracle_adapter = excluded.oracle_adapter,
      oracle_data = excluded.oracle_data,
      refi_data = excluded.refi_data,
      metadata = excluded.metadata,
      borrower_signature = excluded.borrower_signature,
      updated_at = now()
    returning *;
  `;

  const values = [
    body.rfqId,
    body.borrower,
    body.debtToken,
    body.collateralToken,
    body.principal,
    body.repaymentAmount,
    body.minCollateralAmount,
    body.expiry,
    body.callStrike,
    body.putStrike,
    body.oracleAdapter,
    body.oracleData,
    body.refiData,
    body.metadata ?? null,
    body.rfqSignature
  ];

  try {
    const result = await pool.query<RfqRow>(text, values);
    return NextResponse.json({ rfq: result.rows[0] }, { status: 200 });
  } catch (err) {
    console.error('rfq insert error', err);
    return NextResponse.json({ error: 'Database error while saving RFQ' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const result = await pool.query<RfqRow>('select * from rfqs order by created_at desc limit 200');
    return NextResponse.json({ rfqs: result.rows }, { status: 200 });
  } catch (err) {
    console.error('rfq list error', err);
    return NextResponse.json({ error: 'Database error while listing RFQs' }, { status: 500 });
  }
}
