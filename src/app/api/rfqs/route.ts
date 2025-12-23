import { NextRequest, NextResponse } from 'next/server';
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
  'refiData'
];

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
      metadata
    )
    values (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
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
    body.metadata ?? null
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
