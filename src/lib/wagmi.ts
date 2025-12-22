import { QueryClient } from '@tanstack/react-query';
import { http, createConfig } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { zeroLoansChain, appConfig } from './config';

export const wagmiConfig = createConfig({
  chains: [zeroLoansChain],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [zeroLoansChain.id]: http(appConfig.rpcUrl || undefined)
  }
});

export const queryClient = new QueryClient();
