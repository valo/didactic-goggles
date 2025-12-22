import { isAddress, isHex } from 'viem';
import { LoanQuote, OfferPackage, RfqRequest } from './types';
import { hashBytes } from './crypto';

export function validateRfq(rfq: RfqRequest) {
  const errors: Record<string, string> = {};
  const numericFields: Array<[keyof RfqRequest, string]> = [
    ['principal', rfq.principal],
    ['repaymentAmount', rfq.repaymentAmount],
    ['minCollateralAmount', rfq.minCollateralAmount],
    ['expiry', rfq.expiry]
  ];

  if (!isAddress(rfq.borrower)) errors.borrower = 'Borrower address required';
  if (!isAddress(rfq.debtToken)) errors.debtToken = 'Debt token address required';
  if (!isAddress(rfq.collateralToken)) errors.collateralToken = 'Collateral token address required';
  if (!isAddress(rfq.oracleAdapter)) errors.oracleAdapter = 'Oracle adapter address required';

  for (const [field, value] of numericFields) {
    try {
      if (!value || BigInt(value) <= 0n) errors[field as string] = 'Must be > 0';
    } catch {
      errors[field as string] = 'Invalid number';
    }
  }

  if (rfq.expiry) {
    const now = Math.floor(Date.now() / 1000);
    if (Number(rfq.expiry) <= now) errors.expiry = 'Expiry must be in the future';
  }

  const oracleData = rfq.oracleData || '0x';
  if (!isHex(oracleData)) errors.oracleData = 'Oracle data must be hex';
  const refiData = rfq.refiData || '0x';
  if (refiData && !isHex(refiData)) errors.refiData = 'Refinance data must be hex';

  if (rfq.repaymentAmount && rfq.principal) {
    try {
      if (BigInt(rfq.repaymentAmount) < BigInt(rfq.principal)) {
        errors.repaymentAmount = 'Repayment must be >= principal';
      }
    } catch {
      errors.repaymentAmount = 'Invalid number';
    }
  }

  return errors;
}

export function validateQuoteInput(quote: LoanQuote, rfq: RfqRequest) {
  const errors: Record<string, string> = {};
  if (!isAddress(quote.lender)) errors.lender = 'Connect lender wallet';
  if (!quote.deadline || Number(quote.deadline) <= Math.floor(Date.now() / 1000)) {
    errors.deadline = 'Deadline must be in the future';
  }
  if (!quote.nonce) errors.nonce = 'Nonce required';
  if (quote.oracleDataHash !== (rfq.oracleDataHash ?? hashBytes(rfq.oracleData || '0x'))) {
    errors.oracleDataHash = 'Oracle hash mismatch';
  }
  if (quote.refiConfigHash !== (rfq.refiConfigHash ?? hashBytes(rfq.refiData || '0x'))) {
    errors.refiConfigHash = 'Refi hash mismatch';
  }
  if (quote.minCollateralAmount !== rfq.minCollateralAmount) {
    errors.minCollateralAmount = 'Min collateral must match RFQ';
  }
  try {
    if (!quote.putStrike || BigInt(quote.putStrike) <= 0n) {
      errors.putStrike = 'Put strike required';
    } else if (!quote.callStrike || BigInt(quote.callStrike) <= 0n) {
      errors.callStrike = 'Call strike required';
    } else if (BigInt(quote.putStrike) >= BigInt(quote.callStrike)) {
      errors.putStrike = 'Put must be lower than call';
    }
  } catch {
    errors.putStrike = 'Invalid strike inputs';
  }
  return errors;
}

export function validateOfferPackage(pkg: OfferPackage) {
  const errors: Record<string, string> = {};
  if (!isHex(pkg.signature)) errors.signature = 'Invalid signature';
  if (!isHex(pkg.oracleData)) errors.oracleData = 'Oracle data must be hex';
  if (!isHex(pkg.refiData)) errors.refiData = 'Refi data must be hex';
  if (!pkg.rfqId) errors.rfqId = 'Missing rfqId';
  return errors;
}
