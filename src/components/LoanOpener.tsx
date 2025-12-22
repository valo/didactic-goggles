"use client";

import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, CardHeader, Divider, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { Address, isAddress } from 'viem';
import { useAccount, useWriteContract } from 'wagmi';
import { readContract, simulateContract, waitForTransactionReceipt } from 'wagmi/actions';
import { rfqRouterAbi } from '../lib/abi/rfqRouter';
import { erc20Abi } from '../lib/abi/erc20';
import { appConfig } from '../lib/config';
import { hashBytes, verifyQuoteSignature } from '../lib/crypto';
import { loadOffers, saveReceipt } from '../lib/storage';
import { OfferPackage, VaultReceipt } from '../lib/types';
import { validateOfferPackage } from '../lib/validation';
import { wagmiConfig } from '../lib/wagmi';

export default function LoanOpener() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const [offers, setOffers] = useState<OfferPackage[]>([]);
  const [pkg, setPkg] = useState<OfferPackage | null>(null);
  const [collateralAmount, setCollateralAmount] = useState<string>('');
  const [info, setInfo] = useState<string>('');
  const [signatureValid, setSignatureValid] = useState<boolean | null>(null);
  const [txHash, setTxHash] = useState<string>('');
  const [vault, setVault] = useState<string>('');

  useEffect(() => {
    setOffers(loadOffers());
  }, []);

  useEffect(() => {
    if (!pkg) return;
    setCollateralAmount(pkg.quote.minCollateralAmount);
    setSignatureValid(null);
    setTxHash('');
    setVault('');
  }, [pkg]);

  useEffect(() => {
    const verify = async () => {
      if (!pkg) return;
      try {
        const ok = await verifyQuoteSignature(pkg.quote, pkg.signature);
        setSignatureValid(ok);
      } catch {
        setSignatureValid(false);
      }
    };
    verify();
  }, [pkg]);

  const handleSelect = (id: string) => {
    const found = offers.find((o) => o.rfqId === id);
    if (found) {
      const normalized = {
        ...found,
        quote: {
          ...found.quote,
          putStrike: found.quote.putStrike || '0'
        }
      };
      setPkg(normalized);
      setInfo('Loaded stored offer.');
    }
  };

  const preflightOk = useMemo(() => {
    if (!pkg) return false;
    try {
      const now = Math.floor(Date.now() / 1000);
      return (
        Number(pkg.quote.deadline) > now &&
        Number(pkg.quote.expiry) > now &&
        hashBytes(pkg.oracleData || '0x') === pkg.quote.oracleDataHash &&
        hashBytes(pkg.refiData || '0x') === pkg.quote.refiConfigHash &&
        isAddress(appConfig.routerAddress || '')
      );
    } catch {
      return false;
    }
  }, [pkg]);

  const approveCollateral = async () => {
    if (!pkg || !isConnected || !address) {
      setInfo('Connect wallet and import offer.');
      return;
    }
    try {
      const hash = await writeContractAsync({
        address: pkg.quote.collateralToken as Address,
        abi: erc20Abi,
        functionName: 'approve',
        args: [appConfig.routerAddress as Address, BigInt(collateralAmount || '0')]
      });
      setInfo(`Approve tx sent: ${hash}`);
    } catch (err) {
      setInfo((err as Error).message);
    }
  };

  const openLoan = async () => {
    if (!pkg || !isConnected || !address) {
      setInfo('Connect wallet and import offer.');
      return;
    }
    if (!preflightOk) {
      setInfo('Preflight checks failed (hashes/expiry/deadline/router).');
      return;
    }
    try {
      const quoteArgs = {
        lender: pkg.quote.lender as Address,
        debtToken: pkg.quote.debtToken as Address,
        collateralToken: pkg.quote.collateralToken as Address,
        principal: BigInt(pkg.quote.principal),
        repaymentAmount: BigInt(pkg.quote.repaymentAmount),
        minCollateralAmount: BigInt(pkg.quote.minCollateralAmount),
        expiry: BigInt(pkg.quote.expiry),
        callStrike: BigInt(pkg.quote.callStrike),
        putStrike: BigInt(pkg.quote.putStrike),
        oracleAdapter: pkg.quote.oracleAdapter as Address,
        oracleDataHash: pkg.quote.oracleDataHash as `0x${string}`,
        refiConfigHash: pkg.quote.refiConfigHash as `0x${string}`,
        deadline: BigInt(pkg.quote.deadline),
        nonce: BigInt(pkg.quote.nonce)
      };
      const request = await simulateContract(wagmiConfig, {
        address: appConfig.routerAddress as Address,
        abi: rfqRouterAbi,
        functionName: 'openLoan',
        args: [
          quoteArgs,
          BigInt(pkg.quote.minCollateralAmount || '0'),
          pkg.oracleData as `0x${string}`,
          pkg.refiData as `0x${string}`,
          pkg.signature as `0x${string}`
        ],
        account: address as Address
      });
      const txHash = await writeContractAsync(request.request);
      setTxHash(txHash);
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: txHash });
      setVault((request.result as string) || '');
      if (request.result) {
        const receiptData: VaultReceipt = {
          vault: request.result as `0x${string}`,
          lender: pkg.quote.lender as `0x${string}`,
          borrower: address,
          principal: pkg.quote.principal,
          expiry: pkg.quote.expiry,
          txHash: txHash as `0x${string}`
        };
        saveReceipt(receiptData);
      }
      setInfo(`Loan opened. Tx ${txHash}, vault ${request.result as string}`);
      return receipt;
    } catch (err) {
      setInfo((err as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader title="Borrower: open loan from signed quote" />
      <CardContent>
        <TextField
          select
          label="Select stored offer"
          fullWidth
          value={pkg?.rfqId || ''}
          onChange={(e) => handleSelect(e.target.value)}
          SelectProps={{ MenuProps: { disablePortal: true } }}
        >
          <MenuItem value="">-- choose --</MenuItem>
          {offers.map((o) => (
            <MenuItem key={`${o.rfqId}-${o.quote.nonce}`} value={o.rfqId}>
              {o.rfqId}
            </MenuItem>
          ))}
        </TextField>
        {pkg && (
          <Box sx={{ mt: 2, p: 2, border: '1px solid #e2e8f0', borderRadius: 2 }}>
            <Typography variant="subtitle1">Offer summary</Typography>
            <Typography variant="body2">Lender: {pkg.quote.lender}</Typography>
            <Typography variant="body2">Principal: {pkg.quote.principal}</Typography>
            <Typography variant="body2">Min collateral: {pkg.quote.minCollateralAmount}</Typography>
            <Typography variant="body2">Deadline: {pkg.quote.deadline}</Typography>
            <Typography variant="body2">Expiry: {pkg.quote.expiry}</Typography>
            <Typography variant="body2">Call strike: {pkg.quote.callStrike}</Typography>
            <Typography variant="body2">Put strike: {pkg.quote.putStrike}</Typography>
            <Typography variant="body2">
              Signature valid: {signatureValid === null ? 'checking…' : signatureValid ? 'yes' : 'no'}
            </Typography>
          </Box>
        )}
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr' } }}>
          <TextField
            label="Collateral amount"
            value={pkg?.quote.minCollateralAmount || collateralAmount}
            disabled
            helperText="Collateral fixed by offer"
            fullWidth
          />
        </Box>
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={approveCollateral} disabled={!isConnected}>
            Approve collateral
          </Button>
          <Button variant="contained" onClick={openLoan} disabled={!isConnected || isPending}>
            Open loan
          </Button>
        </Stack>
        {txHash && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            Tx hash: {txHash}
          </Typography>
        )}
        {vault && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            Vault: {vault}
          </Typography>
        )}
        {!preflightOk && pkg && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Preflight checks failed (hash mismatch or expired/deadline).
          </Alert>
        )}
        {info && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {info}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
