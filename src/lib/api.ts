import type { OfferPackage, RfqRequest } from './types';

type RfqApiResponse = { rfq: any };
type RfqsApiResponse = { rfqs: any[] };
type QuoteApiResponse = { quote: any };
type QuotesApiResponse = { quotes: any[] };

function mapRfq(row: any): RfqRequest {
  return {
    borrower: row.borrower,
    debtToken: row.debt_token,
    collateralToken: row.collateral_token,
    principal: row.principal,
    repaymentAmount: row.repayment_amount,
    minCollateralAmount: row.min_collateral_amount,
    expiry: row.expiry,
    callStrike: row.call_strike ?? '0',
    putStrike: row.put_strike ?? '0',
    oracleAdapter: row.oracle_adapter,
    oracleData: row.oracle_data ?? '0x',
    refiData: row.refi_data ?? '0x',
    metadata: row.metadata ?? undefined,
    oracleDataHash: row.oracle_data_hash ?? undefined,
    refiConfigHash: row.refi_config_hash ?? undefined,
    rfqId: row.rfq_id
  };
}

function mapQuote(row: any): OfferPackage {
  return {
    rfqId: row.rfq_id,
    oracleData: row.oracle_data ?? '0x',
    refiData: row.refi_data ?? '0x',
    signature: row.signature,
    quote: {
      lender: row.lender,
      debtToken: row.debt_token,
      collateralToken: row.collateral_token,
      principal: row.principal,
      repaymentAmount: row.repayment_amount,
      minCollateralAmount: row.min_collateral_amount,
      expiry: row.expiry,
      callStrike: row.call_strike,
      putStrike: row.put_strike ?? '0',
      oracleAdapter: row.oracle_adapter,
      oracleDataHash: row.oracle_data_hash,
      refiConfigHash: row.refi_config_hash,
      deadline: row.deadline,
      nonce: row.nonce
    }
  };
}

export async function fetchRfqs(): Promise<RfqRequest[]> {
  const res = await fetch('/api/rfqs', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch RFQs');
  const data = (await res.json()) as RfqsApiResponse;
  return (data.rfqs || []).map(mapRfq);
}

export async function saveRfqToApi(rfq: RfqRequest): Promise<RfqRequest> {
  const res = await fetch('/api/rfqs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rfqId: rfq.rfqId,
      borrower: rfq.borrower,
      debtToken: rfq.debtToken,
      collateralToken: rfq.collateralToken,
      principal: rfq.principal,
      repaymentAmount: rfq.repaymentAmount,
      minCollateralAmount: rfq.minCollateralAmount,
      expiry: rfq.expiry,
      callStrike: rfq.callStrike,
      putStrike: rfq.putStrike ?? '0',
      oracleAdapter: rfq.oracleAdapter,
      oracleData: rfq.oracleData,
      refiData: rfq.refiData,
      metadata: rfq.metadata ?? null
    })
  });
  if (!res.ok) throw new Error('Failed to save RFQ');
  const data = (await res.json()) as RfqApiResponse;
  return mapRfq(data.rfq);
}

export async function fetchQuotes(rfqId: string): Promise<OfferPackage[]> {
  const res = await fetch(`/api/rfqs/${rfqId}/quotes`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch quotes');
  const data = (await res.json()) as QuotesApiResponse;
  return (data.quotes || []).map(mapQuote);
}

export async function saveQuoteToApi(rfqId: string, pkg: OfferPackage): Promise<OfferPackage> {
  const res = await fetch(`/api/rfqs/${rfqId}/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lender: pkg.quote.lender,
      debtToken: pkg.quote.debtToken,
      collateralToken: pkg.quote.collateralToken,
      principal: pkg.quote.principal,
      repaymentAmount: pkg.quote.repaymentAmount,
      minCollateralAmount: pkg.quote.minCollateralAmount,
      expiry: pkg.quote.expiry,
      callStrike: pkg.quote.callStrike,
      putStrike: pkg.quote.putStrike,
      oracleAdapter: pkg.quote.oracleAdapter,
      oracleDataHash: pkg.quote.oracleDataHash,
      oracleData: pkg.oracleData,
      refiConfigHash: pkg.quote.refiConfigHash,
      refiData: pkg.refiData,
      deadline: pkg.quote.deadline,
      nonce: pkg.quote.nonce,
      signature: pkg.signature
    })
  });
  if (!res.ok) throw new Error('Failed to save quote');
  const data = (await res.json()) as QuoteApiResponse;
  return mapQuote(data.quote);
}
