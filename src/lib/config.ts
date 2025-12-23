import { defineChain } from 'viem';

const chainIdEnv = process.env.NEXT_PUBLIC_CHAIN_ID ?? '';
const rpcUrlEnv = process.env.NEXT_PUBLIC_RPC_URL ?? '';
const routerAddressEnv = process.env.NEXT_PUBLIC_ROUTER_ADDRESS ?? '';
const assetsEnv = process.env.NEXT_PUBLIC_ASSETS ?? '';
const debtTokensEnv = process.env.NEXT_PUBLIC_DEBT_TOKENS ?? '';
const refiEnabledEnv = process.env.NEXT_PUBLIC_REFI_ENABLED ?? '';
const refiAdapterEnv = process.env.NEXT_PUBLIC_REFI_ADAPTER ?? '';
const refiGracePeriodEnv = process.env.NEXT_PUBLIC_REFI_GRACE_PERIOD ?? '';
const refiMaxLtvEnv = process.env.NEXT_PUBLIC_REFI_MAX_LTV_BPS ?? '';
const refiAdapterDataEnv = process.env.NEXT_PUBLIC_REFI_ADAPTER_DATA ?? '';

export interface AssetConfig {
  symbol: string;
  debtToken: `0x${string}`;
  collateralToken: `0x${string}`;
  oracleAdapter: `0x${string}`;
}

export interface DebtTokenConfig {
  symbol: string;
  address: `0x${string}`;
}

export interface RefiConfig {
  enabled: boolean;
  adapter: `0x${string}`;
  gracePeriod: number;
  maxLtvBps: number;
  adapterData: `0x${string}`;
}

function parseAssets(): AssetConfig[] {
  if (!assetsEnv) {
    return [];
  }
  try {
    const parsed = JSON.parse(assetsEnv) as AssetConfig[];
    return parsed.filter(
      (a) => a.symbol && a.debtToken?.startsWith('0x') && a.collateralToken?.startsWith('0x') && a.oracleAdapter?.startsWith('0x')
    );
  } catch {
    return [];
  }
}

function parseDebtTokens(): DebtTokenConfig[] {
  if (!debtTokensEnv) {
    return [];
  }
  try {
    const parsed = JSON.parse(debtTokensEnv) as DebtTokenConfig[];
    return parsed.filter((d) => d.symbol && d.address?.startsWith('0x'));
  } catch {
    return [];
  }
}

// Fallback sample assets (must be overridden in env)
const fallbackAssets: AssetConfig[] = [
  {
    symbol: 'WETH',
    debtToken: '0x0000000000000000000000000000000000000001',
    collateralToken: '0x0000000000000000000000000000000000000001',
    oracleAdapter: '0x0000000000000000000000000000000000000001'
  },
  {
    symbol: 'WBTC',
    debtToken: '0x0000000000000000000000000000000000000002',
    collateralToken: '0x0000000000000000000000000000000000000002',
    oracleAdapter: '0x0000000000000000000000000000000000000002'
  }
];

const fallbackDebtTokens: DebtTokenConfig[] = [
  { symbol: 'USDC', address: '0x0000000000000000000000000000000000000003' },
  { symbol: 'USDT', address: '0x0000000000000000000000000000000000000004' }
];

function parseRefi(): RefiConfig | null {
  const enabled = refiEnabledEnv === 'true' || refiEnabledEnv === '1';
  if (!enabled) return null;
  if (!refiAdapterEnv?.startsWith('0x')) return null;
  const gracePeriod = Number(refiGracePeriodEnv || '0');
  const maxLtvBps = Number(refiMaxLtvEnv || '0');
  const adapterData = (refiAdapterDataEnv || '0x') as `0x${string}`;
  return {
    enabled: true,
    adapter: refiAdapterEnv as `0x${string}`,
    gracePeriod: Number.isFinite(gracePeriod) ? gracePeriod : 0,
    maxLtvBps: Number.isFinite(maxLtvBps) ? maxLtvBps : 0,
    adapterData
  };
}

export const appConfig = {
  chainId: chainIdEnv ? Number(chainIdEnv) : 0,
  rpcUrl: rpcUrlEnv,
  routerAddress: routerAddressEnv as `0x${string}`,
  assets: parseAssets().length ? parseAssets() : fallbackAssets,
  debtTokens: parseDebtTokens().length ? parseDebtTokens() : fallbackDebtTokens,
  refi: parseRefi()
};

export const zeroLoansChain = defineChain({
  id: appConfig.chainId || 1,
  name: 'Zero Loans',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: appConfig.rpcUrl ? [appConfig.rpcUrl] : [] },
    public: { http: appConfig.rpcUrl ? [appConfig.rpcUrl] : [] }
  }
});

export const routerDomain = {
  name: 'ZeroLoansRFQRouter',
  version: '1',
  chainId: BigInt(appConfig.chainId || 0),
  verifyingContract: appConfig.routerAddress
};

export const isConfigReady = Boolean(appConfig.chainId && appConfig.rpcUrl && appConfig.routerAddress);
