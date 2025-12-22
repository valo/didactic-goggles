import { encodeAbiParameters, hexToBytes, isAddress, isHex, keccak256, recoverTypedDataAddress, type Address } from 'viem';
import { routerDomain } from './config';
import { LoanQuote, RfqRequest } from './types';

export const quoteTypes = {
  LoanQuote: [
    { name: 'lender', type: 'address' },
    { name: 'debtToken', type: 'address' },
    { name: 'collateralToken', type: 'address' },
    { name: 'principal', type: 'uint256' },
    { name: 'repaymentAmount', type: 'uint256' },
    { name: 'minCollateralAmount', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
    { name: 'callStrike', type: 'uint256' },
    { name: 'putStrike', type: 'uint256' },
    { name: 'oracleAdapter', type: 'address' },
    { name: 'oracleDataHash', type: 'bytes32' },
    { name: 'refiConfigHash', type: 'bytes32' },
    { name: 'deadline', type: 'uint256' },
    { name: 'nonce', type: 'uint256' }
  ]
} as const;

export function ensure0x(value: string) {
  if (!value) return '0x';
  return value.startsWith('0x') ? value : (`0x${value}` as const);
}

export function normalizeHex(value: string) {
  const prefixed = ensure0x(value);
  if (!isHex(prefixed)) {
    throw new Error('Invalid hex string');
  }
  return prefixed as `0x${string}`;
}

export function hashBytes(data: string): `0x${string}` {
  const normalized = normalizeHex(data);
  return keccak256(hexToBytes(normalized));
}

export function computeRfqId(rfq: RfqRequest) {
  const oracleHash = (rfq.oracleDataHash ?? hashBytes(rfq.oracleData || '0x')) as `0x${string}`;
  const refiHash = (rfq.refiConfigHash ?? hashBytes(rfq.refiData || '0x')) as `0x${string}`;
  const meta = rfq.metadata ?? {};
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'address', name: 'borrower' },
        { type: 'address', name: 'debtToken' },
        { type: 'address', name: 'collateralToken' },
        { type: 'uint256', name: 'principal' },
        { type: 'uint256', name: 'repaymentAmount' },
        { type: 'uint256', name: 'minCollateralAmount' },
        { type: 'uint256', name: 'expiry' },
        { type: 'uint256', name: 'callStrike' },
        { type: 'address', name: 'oracleAdapter' },
        { type: 'bytes32', name: 'oracleDataHash' },
        { type: 'bytes32', name: 'refiConfigHash' },
        { type: 'string', name: 'label' },
        { type: 'string', name: 'notes' },
        { type: 'bool', name: 'editableTerms' }
      ],
      [
        rfq.borrower as Address,
        rfq.debtToken as Address,
        rfq.collateralToken as Address,
        BigInt(rfq.principal || '0'),
        BigInt(rfq.repaymentAmount || '0'),
        BigInt(rfq.minCollateralAmount || '0'),
        BigInt(rfq.expiry || '0'),
        BigInt(rfq.callStrike || '0'),
        rfq.oracleAdapter as Address,
        oracleHash,
        refiHash,
        meta.label ?? '',
        meta.notes ?? '',
        Boolean(meta.editableTerms)
      ]
    )
  );
}

export async function verifyQuoteSignature(message: LoanQuote, signature: string) {
  if (!isAddress(message.lender)) {
    return false;
  }
  const numericMessage = {
    ...message,
    principal: BigInt(message.principal),
    repaymentAmount: BigInt(message.repaymentAmount),
    minCollateralAmount: BigInt(message.minCollateralAmount),
    expiry: BigInt(message.expiry),
    callStrike: BigInt(message.callStrike),
    putStrike: BigInt(message.putStrike),
    deadline: BigInt(message.deadline),
    nonce: BigInt(message.nonce)
  };
  const recovered = await recoverTypedDataAddress({
    domain: routerDomain,
    types: quoteTypes,
    primaryType: 'LoanQuote',
    message: {
      ...numericMessage,
      lender: message.lender as Address,
      debtToken: message.debtToken as Address,
      collateralToken: message.collateralToken as Address,
      oracleAdapter: message.oracleAdapter as Address,
      oracleDataHash: message.oracleDataHash as `0x${string}`,
      refiConfigHash: message.refiConfigHash as `0x${string}`
    },
    signature: signature as `0x${string}`
  });
  return (recovered as Address).toLowerCase() === message.lender.toLowerCase();
}
