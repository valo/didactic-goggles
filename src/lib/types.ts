export interface RefiConfig {
  enabled: boolean;
  adapter: string;
  gracePeriod: string; // seconds, stringified number
  maxLtvBps: string; // basis points
  adapterData: string;
}

export interface RfqMetadata {
  label?: string;
  notes?: string;
  editableTerms?: boolean;
}

export interface RfqRequest {
  borrower: string;
  debtToken: string;
  collateralToken: string;
  principal: string;
  repaymentAmount: string;
  minCollateralAmount: string;
  expiry: string; // unix seconds as string
  callStrike: string; // lender-defined; borrower RFQ may set to 0 as placeholder
  oracleAdapter: string;
  oracleData: string;
  refiData: string;
  metadata?: RfqMetadata;
  oracleDataHash?: string;
  refiConfigHash?: string;
  rfqId?: string;
  attestation?: {
    signer: string;
    signature: string;
    timestamp: number;
  };
}

export interface LoanQuote {
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
  refiConfigHash: string;
  deadline: string;
  nonce: string;
}

export interface OfferPackage {
  quote: LoanQuote;
  signature: string;
  oracleData: string;
  refiData: string;
  rfqId: string;
}

export interface VaultReceipt {
  vault: string;
  lender: string;
  borrower: string;
  principal: string;
  expiry: string;
  txHash: string;
}
