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
  FormControlLabel,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { useAccount, useBalance, useSignTypedData, useWriteContract } from 'wagmi';
import { readContract } from 'wagmi/actions';
import { Address, isAddress } from 'viem';
import { erc20Abi } from '../lib/abi/erc20';
import { rfqRouterAbi } from '../lib/abi/rfqRouter';
import { appConfig, routerDomain } from '../lib/config';
import { quoteTypes, hashBytes } from '../lib/crypto';
import { validateQuoteInput } from '../lib/validation';
import { LoanQuote, OfferPackage, RfqRequest } from '../lib/types';
import { wagmiConfig } from '../lib/wagmi';
import { fetchRfqs, saveQuoteToApi } from '../lib/api';

const emptyQuote: LoanQuote = {
  lender: '',
  debtToken: '',
  collateralToken: '',
  principal: '',
  repaymentAmount: '',
  minCollateralAmount: '',
  expiry: '',
  callStrike: '',
  putStrike: '',
  oracleAdapter: '',
  oracleDataHash: '0x',
  refiConfigHash: '0x',
  deadline: '',
  nonce: ''
};

export default function OfferSigner() {
  const { address, isConnected } = useAccount();
  const { data: lenderBalance } = useBalance({ address, query: { enabled: Boolean(address) } });
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync, isPending: approving } = useWriteContract();

  const [rfqs, setRfqs] = useState<RfqRequest[]>([]);
  const [rfq, setRfq] = useState<RfqRequest | null>(null);
  const [quote, setQuote] = useState<LoanQuote>(emptyQuote);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [info, setInfo] = useState<string>('');
  const [feePreview, setFeePreview] = useState<bigint | null>(null);
  const [signedPkg, setSignedPkg] = useState<OfferPackage | null>(null);
  const [callStrike, setCallStrike] = useState<string>('');
  const [putStrike, setPutStrike] = useState<string>('');
  const [loadingRfqs, setLoadingRfqs] = useState<boolean>(false);

  const loadRfqsFromApi = () => {
    setLoadingRfqs(true);
    fetchRfqs()
      .then((data) => setRfqs(data))
      .catch((err) => setInfo((err as Error).message))
      .finally(() => setLoadingRfqs(false));
  };

  useEffect(() => {
    loadRfqsFromApi();
  }, []);

  useEffect(() => {
    if (rfq) {
      setQuote((prev) => ({
        ...prev,
        debtToken: rfq.debtToken,
        collateralToken: rfq.collateralToken,
        principal: rfq.principal,
        repaymentAmount: rfq.repaymentAmount,
        minCollateralAmount: rfq.minCollateralAmount,
        expiry: rfq.expiry,
        callStrike: rfq.callStrike,
        putStrike: '',
        oracleAdapter: rfq.oracleAdapter,
        oracleDataHash: rfq.oracleDataHash as `0x${string}`,
        refiConfigHash: rfq.refiConfigHash as `0x${string}`
      }));
    }
  }, [rfq]);

  useEffect(() => {
    if (!rfq) return;
    const loadFee = async () => {
      try {
        const now = BigInt(Math.floor(Date.now() / 1000));
        const fee = await readContract(wagmiConfig, {
          address: appConfig.routerAddress as Address,
          abi: rfqRouterAbi,
          functionName: 'previewFee',
          args: [BigInt(quote.principal || '0'), BigInt(rfq.expiry || '0'), now]
        });
        setFeePreview(fee);
      } catch {
        setFeePreview(null);
      }
    };
    loadFee();
  }, [rfq, quote.principal]);

  const handleSelectRfq = (selected: RfqRequest) => {
    setRfq(selected);
    setCallStrike(selected.callStrike || '');
    setPutStrike(selected.putStrike || '');
    setInfo('Loaded RFQ from server.');
  };

  const editable = Boolean(rfq?.metadata?.editableTerms);

  const handleQuoteChange = (key: keyof LoanQuote) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuote((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const buildQuote = (): LoanQuote | null => {
    if (!rfq) {
      setInfo('Import or select an RFQ first.');
      return null;
    }
    const nextQuote: LoanQuote = {
      lender: (address || '') as `0x${string}`,
      debtToken: rfq.debtToken,
      collateralToken: rfq.collateralToken,
      principal: editable ? quote.principal : rfq.principal,
      repaymentAmount: editable ? quote.repaymentAmount : rfq.repaymentAmount,
      minCollateralAmount: rfq.minCollateralAmount,
      expiry: rfq.expiry,
      callStrike: callStrike || '0',
      putStrike: putStrike || '0',
      oracleAdapter: rfq.oracleAdapter,
      oracleDataHash: rfq.oracleDataHash as `0x${string}`,
      refiConfigHash: rfq.refiConfigHash as `0x${string}`,
      deadline: quote.deadline,
      nonce: quote.nonce
    };
    const strikeErrors: Record<string, string> = {};
    if (!callStrike || BigInt(callStrike || '0') <= 0n) {
      strikeErrors.callStrike = 'Call strike required';
    }
    if (!putStrike || BigInt(putStrike || '0') <= 0n) {
      strikeErrors.putStrike = 'Put strike required';
    }
    if (!strikeErrors.putStrike && !strikeErrors.callStrike) {
      try {
        if (BigInt(putStrike) >= BigInt(callStrike)) {
          strikeErrors.putStrike = 'Put must be lower than call';
        }
      } catch {
        strikeErrors.putStrike = 'Invalid strikes';
      }
    }
    if (Object.keys(strikeErrors).length) {
      setErrors(strikeErrors);
      return null;
    }
    const validation = validateQuoteInput(nextQuote, rfq);
    if (Object.keys(validation).length) {
      setErrors(validation);
      return null;
    }
    setErrors({});
    return nextQuote;
  };

  const signOffer = async () => {
    try {
      const message = buildQuote();
      if (!message) return;
      if (!isConnected || !address) {
        setInfo('Connect lender wallet.');
        return;
      }
      if (!isAddress(message.lender) || message.lender.toLowerCase() !== address.toLowerCase()) {
        setInfo('Connected wallet must match lender.');
        return;
      }
      const signature = await signTypedDataAsync({
        domain: routerDomain,
        types: quoteTypes,
        primaryType: 'LoanQuote',
        message: {
          ...message,
          lender: message.lender as Address,
          debtToken: message.debtToken as Address,
          collateralToken: message.collateralToken as Address,
          oracleAdapter: message.oracleAdapter as Address,
          oracleDataHash: message.oracleDataHash as `0x${string}`,
          refiConfigHash: message.refiConfigHash as `0x${string}`,
          principal: BigInt(message.principal),
          repaymentAmount: BigInt(message.repaymentAmount),
          minCollateralAmount: BigInt(message.minCollateralAmount),
          expiry: BigInt(message.expiry),
          callStrike: BigInt(message.callStrike),
          putStrike: BigInt(message.putStrike),
          deadline: BigInt(message.deadline),
          nonce: BigInt(message.nonce)
        }
      });

      const pkg: OfferPackage = {
        quote: message,
        signature,
        oracleData: rfq?.oracleData || '0x',
        refiData: rfq?.refiData || '0x',
        rfqId: (rfq?.rfqId || '0x') as `0x${string}`
      };
      const saved = await saveQuoteToApi(pkg.rfqId, pkg);
      setInfo('Offer signed and stored on server.');
      setSignedPkg(saved);
      await navigator.clipboard.writeText(JSON.stringify(saved, null, 2));
    } catch (err) {
      setInfo((err as Error).message);
    }
  };

  const approveFunding = async () => {
    if (!rfq || !isConnected || !address) {
      setInfo('Connect and load RFQ first.');
      return;
    }
    try {
      const fee = feePreview || 0n;
      const amount = BigInt(quote.principal || rfq.principal || '0') + fee;
      const hash = await writeContractAsync({
        address: rfq.debtToken as Address,
        abi: erc20Abi,
        functionName: 'approve',
        args: [appConfig.routerAddress as Address, amount]
      });
      setInfo(`Approve tx sent: ${hash}`);
    } catch (err) {
      setInfo((err as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader title="Lender: review RFQ and sign offer" />
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1">Available RFQs</Typography>
            <Button size="small" onClick={loadRfqsFromApi} disabled={loadingRfqs}>
              Refresh
            </Button>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Label</TableCell>
                <TableCell>RFQ ID</TableCell>
                <TableCell>Borrower</TableCell>
                <TableCell>Principal</TableCell>
                <TableCell>Collateral</TableCell>
                <TableCell>Select</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rfqs.map((item) => (
                <TableRow key={item.rfqId} hover selected={rfq?.rfqId === item.rfqId}>
                  <TableCell>{item.metadata?.label || '—'}</TableCell>
                  <TableCell sx={{ maxWidth: 180, wordBreak: 'break-all' }}>{item.rfqId}</TableCell>
                  <TableCell>{item.borrower}</TableCell>
                  <TableCell>{item.principal}</TableCell>
                  <TableCell>{item.collateralToken}</TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => handleSelectRfq(item)}>
                      Use
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rfqs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>{loadingRfqs ? 'Loading…' : 'No RFQs found'}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {rfq && (
            <Box sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <Typography variant="subtitle1">RFQ summary</Typography>
              <Typography variant="body2">RFQ ID: {rfq.rfqId}</Typography>
              <Typography variant="body2">Borrower: {rfq.borrower}</Typography>
              <Typography variant="body2">Expiry: {rfq.expiry}</Typography>
              <Typography variant="body2">Oracle hash: {rfq.oracleDataHash}</Typography>
              <Typography variant="body2">Refi hash: {rfq.refiConfigHash}</Typography>
            </Box>
          )}
          <Divider />
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            <TextField
              label="Deadline (unix seconds)"
              value={quote.deadline}
              onChange={handleQuoteChange('deadline')}
              error={Boolean(errors.deadline)}
              helperText={errors.deadline}
              fullWidth
            />
            <TextField
              label="Nonce"
              value={quote.nonce}
              onChange={handleQuoteChange('nonce')}
              error={Boolean(errors.nonce)}
              helperText={errors.nonce}
              fullWidth
            />
            <TextField
              label="Call strike"
              value={callStrike}
              onChange={(e) => setCallStrike(e.target.value)}
              error={Boolean(errors.callStrike)}
              helperText={errors.callStrike || 'Lender-defined call price'}
              fullWidth
            />
            <TextField
              label="Put strike"
              value={putStrike}
              onChange={(e) => setPutStrike(e.target.value)}
              error={Boolean(errors.putStrike)}
              fullWidth
              helperText={errors.putStrike || 'Lender-defined put price; must be below call'}
            />
            <TextField
              label="Principal"
              value={quote.principal}
              disabled={!editable}
              onChange={handleQuoteChange('principal')}
              helperText={!editable ? 'Locked to RFQ' : undefined}
              fullWidth
            />
            <TextField
              label="Repayment amount"
              value={quote.repaymentAmount}
              disabled={!editable}
              onChange={handleQuoteChange('repaymentAmount')}
              helperText={!editable ? 'Locked to RFQ' : undefined}
              fullWidth
            />
          </Box>
          <FormControlLabel
            control={<Switch checked={editable} disabled />}
            label="RFQ allows editable terms"
          />
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2">
              Fee preview: {feePreview !== null ? feePreview.toString() : 'n/a'}
            </Typography>
            {lenderBalance && (
              <Typography variant="body2" color="text.secondary">
                Balance: {lenderBalance.value.toString()} {lenderBalance.symbol}
              </Typography>
            )}
          </Stack>
          <Stack direction="row" spacing={2}>
            <Button variant="contained" onClick={signOffer} disabled={!isConnected}>
              Sign offer (EIP-712)
            </Button>
            <Button variant="outlined" onClick={approveFunding} disabled={!isConnected || approving}>
              Approve debt token
            </Button>
          </Stack>
          {signedPkg && (
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                onClick={() =>
                  navigator.clipboard.writeText(JSON.stringify(signedPkg, null, 2)).then(() => setInfo('Offer copied'))
                }
              >
                Copy offer JSON
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(signedPkg, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `${signedPkg.rfqId}-offer.json`;
                  link.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download offer JSON
              </Button>
            </Stack>
          )}
          {info && <Alert severity="info">{info}</Alert>}
        </Stack>
      </CardContent>
    </Card>
  );
}
