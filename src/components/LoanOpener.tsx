"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { Address, isAddress } from 'viem';
import { useAccount, useWriteContract } from 'wagmi';
import { simulateContract, waitForTransactionReceipt } from 'wagmi/actions';
import { rfqRouterAbi } from '../lib/abi/rfqRouter';
import { erc20Abi } from '../lib/abi/erc20';
import { appConfig } from '../lib/config';
import { hashBytes, verifyQuoteSignature } from '../lib/crypto';
import { saveReceipt } from '../lib/storage';
import { OfferPackage, VaultReceipt } from '../lib/types';
import { wagmiConfig } from '../lib/wagmi';
import { fetchQuotes, fetchRfqs } from '../lib/api';

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
  const [rfqs, setRfqs] = useState<{ rfqId: string; label?: string }[]>([]);
  const [selectedRfqId, setSelectedRfqId] = useState<string>('');
  const [loadingQuotes, setLoadingQuotes] = useState<boolean>(false);

  const refreshRfqs = () =>
    fetchRfqs()
      .then((data) => setRfqs(data.map((r) => ({ rfqId: r.rfqId!, label: r.metadata?.label }))))
      .catch((err) => setInfo((err as Error).message));

  useEffect(() => {
    refreshRfqs();
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

  const loadQuotesForRfq = (rfqId: string) => {
    setLoadingQuotes(true);
    fetchQuotes(rfqId)
      .then((data) => {
        setSelectedRfqId(rfqId);
        setOffers(data);
        setPkg(null);
        setInfo('Loaded offers from server.');
      })
      .catch((err) => setInfo((err as Error).message))
      .finally(() => setLoadingQuotes(false));
  };

  const handleSelect = (id: string, nonce: string) => {
    const found = offers.find((o) => o.rfqId === id && o.quote.nonce === nonce);
    if (found) {
      setPkg(found);
      setInfo('Loaded offer.');
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
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1">RFQs</Typography>
            <Button size="small" onClick={refreshRfqs}>
              Refresh
            </Button>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Label</TableCell>
                <TableCell>RFQ ID</TableCell>
                <TableCell>Select</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rfqs.map((r) => (
                <TableRow key={r.rfqId} hover selected={selectedRfqId === r.rfqId}>
                  <TableCell>{r.label || '—'}</TableCell>
                  <TableCell sx={{ maxWidth: 180, wordBreak: 'break-all' }}>{r.rfqId}</TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => loadQuotesForRfq(r.rfqId)}>
                      Load offers
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rfqs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>No RFQs found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Divider />
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1">Offers for RFQ {selectedRfqId || '(select RFQ)'}</Typography>
            <Typography variant="body2" color="text.secondary">
              {loadingQuotes ? 'Loading…' : ''}
            </Typography>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Lender</TableCell>
                <TableCell>Principal</TableCell>
                <TableCell>Deadline</TableCell>
                <TableCell>Expiry</TableCell>
                <TableCell>Nonce</TableCell>
                <TableCell>Select</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {offers.map((o) => (
                <TableRow key={`${o.rfqId}-${o.quote.nonce}`} hover selected={pkg?.rfqId === o.rfqId && pkg?.quote.nonce === o.quote.nonce}>
                  <TableCell sx={{ maxWidth: 160, wordBreak: 'break-all' }}>{o.quote.lender}</TableCell>
                  <TableCell>{o.quote.principal}</TableCell>
                  <TableCell>{o.quote.deadline}</TableCell>
                  <TableCell>{o.quote.expiry}</TableCell>
                  <TableCell>{o.quote.nonce}</TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => handleSelect(o.rfqId, o.quote.nonce)}>
                      Use
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {offers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>{loadingQuotes ? 'Loading…' : 'No offers found'}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Stack>
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
