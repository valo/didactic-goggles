"use client";

import { useMemo } from 'react';
import { Alert, Box, Button, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { appConfig, zeroLoansChain } from '../lib/config';

export default function WalletControls() {
  const { address, isConnected, status } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const chainMismatch = isConnected && appConfig.chainId && chainId !== appConfig.chainId;
  const connector = connectors[0];

  const shortAddress = useMemo(() => {
    if (!address) return '';
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }, [address]);

  return (
    <Stack direction="column" spacing={1} alignItems="flex-end">
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip
          label={`Chain: ${zeroLoansChain.name} (${appConfig.chainId || 'unset'})`}
          color={chainMismatch ? 'warning' : 'default'}
          variant="outlined"
          size="small"
        />
        <Tooltip title={`Router: ${appConfig.routerAddress || 'not set'}`}>
          <Chip label="Router configured" color={appConfig.routerAddress ? 'primary' : 'warning'} size="small" />
        </Tooltip>
        {isConnected ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {shortAddress}
            </Typography>
            {chainMismatch ? (
              <Button
                variant="contained"
                color="warning"
                size="small"
                onClick={() => switchChain?.({ chainId: appConfig.chainId })}
              >
                Switch network
              </Button>
            ) : (
              <Button variant="outlined" size="small" onClick={() => disconnect()}>
                Disconnect
              </Button>
            )}
          </Stack>
        ) : (
          <Button
            variant="contained"
            size="small"
            disabled={!connector || connecting}
            onClick={() => connector && connect({ connector })}
          >
            {connecting ? 'Connecting…' : 'Connect wallet'}
          </Button>
        )}
      </Stack>
      {status === 'connecting' && (
        <Typography variant="body2" color="text.secondary">
          Connecting…
        </Typography>
      )}
      {chainMismatch && (
        <Alert severity="warning" variant="outlined" sx={{ py: 0.5 }}>
          Wrong chain. Switch to chain ID {appConfig.chainId} to proceed.
        </Alert>
      )}
    </Stack>
  );
}
