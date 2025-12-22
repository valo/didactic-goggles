import { OfferPackage, RfqRequest, VaultReceipt } from './types';

const RFQ_KEY = 'zero-rfqs';
const OFFER_KEY = 'zero-offers';
const RECEIPT_KEY = 'zero-vault-receipts';

function read<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function write<T>(key: string, data: T[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(data));
}

export function saveRfq(rfq: RfqRequest) {
  const items = read<RfqRequest>(RFQ_KEY).filter((r) => r.rfqId !== rfq.rfqId);
  items.unshift(rfq);
  write(RFQ_KEY, items.slice(0, 20));
}

export function loadRfqs() {
  return read<RfqRequest>(RFQ_KEY);
}

export function saveOffer(pkg: OfferPackage) {
  const items = read<OfferPackage>(OFFER_KEY).filter(
    (o) => !(o.rfqId === pkg.rfqId && o.quote.nonce === pkg.quote.nonce)
  );
  items.unshift(pkg);
  write(OFFER_KEY, items.slice(0, 30));
}

export function loadOffers() {
  return read<OfferPackage>(OFFER_KEY);
}

export function saveReceipt(receipt: VaultReceipt) {
  const items = read<VaultReceipt>(RECEIPT_KEY).filter((r) => r.vault !== receipt.vault);
  items.unshift(receipt);
  write(RECEIPT_KEY, items.slice(0, 30));
}

export function loadReceipts() {
  return read<VaultReceipt>(RECEIPT_KEY);
}
