import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/server/db';
import type { QuoteRow } from '@/lib/server/types';

type IncomingQuote = {
  lender: string;
  debtToken: string;
  collateralToken: string;
  principal: string;
  repaymentAmount: string;
  minCollateralAmount: string;
  expiry: string;
  callStrike: string;
  putStrike: string;
  oracleAdapter: string;
  oracleDataHash: string;
  oracleData?: string;
  refiConfigHash: string;
  refiData?: string;
  deadline: string;
  nonce: string;
  signature: string;
};

const requiredFields: Array<keyof IncomingQuote> = [
  'lender',
  'debtToken',
  'collateralToken',
  'principal',
  'repaymentAmount',
  'minCollateralAmount',
  'expiry',
  'callStrike',
  'putStrike',
  'oracleAdapter',
  'oracleDataHash',
  'refiConfigHash',
  'deadline',
  'nonce',
  'signature'
];

export async function POST(req: NextRequest, { params }: { params: Promise<{ rfqId: string }> }) {
  const { rfqId } = await params;
  let body: IncomingQuote;
  try {
    body = (await req.json()) as IncomingQuote;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const missing = requiredFields.filter((f) => !body[f]);
  if (missing.length) {
    return NextResponse.json({ error: `Missing fields: ${missing.join(', ')}` }, { status: 400 });
  }

  const text = `
    insert into quotes (
      rfq_id,
      lender,
      debt_token,
      collateral_token,
      principal,
      repayment_amount,
      min_collateral_amount,
      expiry,
      call_strike,
      put_strike,
      oracle_adapter,
      oracle_data_hash,
      oracle_data,
      refi_config_hash,
      refi_data,
      deadline,
      nonce,
      signature
    )
    values (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
    )
    returning *;
  `;

  const values = [
    rfqId,
    body.lender,
    body.debtToken,
    body.collateralToken,
    body.principal,
    body.repaymentAmount,
    body.minCollateralAmount,
    body.expiry,
    body.callStrike,
    body.putStrike,
    body.oracleAdapter,
    body.oracleDataHash,
    body.refiConfigHash,
    body.oracleData ?? null,
    body.refiData ?? null,
    body.deadline,
    body.nonce,
    body.signature
  ];

  try {
    const result = await pool.query<QuoteRow>(text, values);
    return NextResponse.json({ quote: result.rows[0] }, { status: 200 });
  } catch (err) {
    console.error('quote insert error', err);
    return NextResponse.json({ error: 'Database error while saving quote' }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ rfqId: string }> }) {
  try {
    const { rfqId } = await params;
    const result = await pool.query<QuoteRow>(
      'select * from quotes where rfq_id = $1 order by created_at desc limit 200',
      [rfqId]
    );
    return NextResponse.json({ quotes: result.rows }, { status: 200 });
  } catch (err) {
    console.error('quote list error', err);
    return NextResponse.json({ error: 'Database error while listing quotes' }, { status: 500 });
  }
}
