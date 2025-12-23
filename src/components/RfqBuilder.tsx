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
  MenuItem,
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
import { Address, encodeAbiParameters } from 'viem';
import { useAccount, useSignMessage } from 'wagmi';
import { RfqRequest } from '../lib/types';
import { computeRfqId, ensure0x, hashBytes, normalizeHex } from '../lib/crypto';
import { validateRfq } from '../lib/validation';
import { appConfig, AssetConfig, DebtTokenConfig } from '../lib/config';
import { fetchRfqs, saveRfqToApi } from '../lib/api';

interface FormState {
  borrower: string;
  debtToken: string;
  collateralToken: string;
  principal: string;
  repaymentAmount: string;
  minCollateralAmount: string;
  expiryDuration: string; // seconds offset
  oracleAdapter: string;
  oracleData: string;
  label: string;
  notes: string;
  editableTerms: boolean;
}

const initialState: FormState = {
  borrower: '',
  debtToken: '',
  collateralToken: '',
  principal: '',
  repaymentAmount: '',
  minCollateralAmount: '',
  expiryDuration: '',
  oracleAdapter: '',
  oracleData: '0x',
  label: '',
  notes: '',
  editableTerms: false
};

const NOW_SECONDS_BASE = Math.floor(Date.now() / 1000);

export default function RfqBuilder() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [baseTime] = useState<number>(NOW_SECONDS_BASE);
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rfq, setRfq] = useState<RfqRequest | null>(null);
  const [message, setMessage] = useState<string>('');
  const [rfqs, setRfqs] = useState<RfqRequest[]>([]);
  const [loadingRfqs, setLoadingRfqs] = useState<boolean>(false);
  const assets = appConfig.assets;
  const debtTokens = appConfig.debtTokens;

  const borrowerValue = form.borrower || address || '';

  const expirySeconds = useMemo(() => {
    if (!form.expiryDuration) return '';
    return (baseTime + Number(form.expiryDuration)).toString();
  }, [form.expiryDuration, baseTime]);

  const expiryDisplay = useMemo(() => {
    if (!expirySeconds) return 'N/A';
    const date = new Date(Number(expirySeconds) * 1000);
    return date.toUTCString();
  }, [expirySeconds]);

  const handleChange = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const buildRefiData = () => {
    if (!appConfig.refi?.enabled) return '0x';
    return encodeAbiParameters(
      [
        { type: 'bool', name: 'enabled' },
        { type: 'address', name: 'adapter' },
        { type: 'uint256', name: 'gracePeriod' },
        { type: 'uint256', name: 'maxLtvBps' },
        { type: 'bytes', name: 'adapterData' }
      ],
      [
        true,
        appConfig.refi.adapter,
        BigInt(appConfig.refi.gracePeriod || 0),
        BigInt(appConfig.refi.maxLtvBps || 0),
        normalizeHex(appConfig.refi.adapterData || '0x')
      ]
    );
  };

  const handleGenerate = () => {
    try {
      const refiData = buildRefiData() as `0x${string}`;
      const rfqPayload: RfqRequest = {
        borrower: form.borrower,
        debtToken: form.debtToken,
        collateralToken: form.collateralToken,
        principal: form.principal,
        repaymentAmount: form.principal,
        minCollateralAmount: form.minCollateralAmount,
        expiry: expirySeconds,
        callStrike: '0',
        oracleAdapter: form.oracleAdapter,
        oracleData: ensure0x(form.oracleData),
        refiData: ensure0x(refiData),
        metadata: { label: form.label, notes: form.notes, editableTerms: form.editableTerms }
      };
      const validation = validateRfq(rfqPayload);
      if (Object.keys(validation).length) {
        setErrors(validation);
        setMessage('');
        return;
      }
      const oracleDataHash = hashBytes(rfqPayload.oracleData);
      const refiConfigHash = hashBytes(rfqPayload.refiData || '0x');
      const rfqId = computeRfqId({ ...rfqPayload, oracleDataHash, refiConfigHash });
      const fullRfq: RfqRequest = { ...rfqPayload, oracleDataHash, refiConfigHash, rfqId };
      setErrors({});
      if (!address) {
        setMessage('Connect wallet to sign RFQ.');
        return;
      }
      signMessageAsync({ message: rfqId as `0x${string}` })
        .then((sig) => saveRfqToApi({ ...fullRfq, rfqSignature: sig }))
        .then((saved) => {
          setRfq(saved);
          setMessage('RFQ saved to server.');
          setRfqs((prev) => [saved, ...prev.filter((r) => r.rfqId !== saved.rfqId)]);
        })
        .catch((err) => setMessage((err as Error).message));
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  const loadRfqsFromApi = () => {
    setLoadingRfqs(true);
    fetchRfqs()
      .then((data) => setRfqs(data))
      .catch((err) => setMessage((err as Error).message))
      .finally(() => setLoadingRfqs(false));
  };

  useEffect(() => {
    // Data fetch from API; state updates are intentional here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRfqsFromApi();
  }, []);

  return (
    <Card>
      <CardHeader title="Create RFQ (Borrower)" subheader="Draft unsigned RFQ metadata to share with lenders." />
      <CardContent>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }
          }}
        >
          <Box>
            <Stack spacing={2}>
              <TextField
                label="Borrower"
                value={borrowerValue}
                onChange={handleChange('borrower')}
                error={Boolean(errors.borrower)}
                helperText={errors.borrower || 'Defaults to connected wallet'}
                fullWidth
              />
              <TextField
                select
                label="Debt token (0% APR)"
                value={form.debtToken}
                onChange={(e) => setForm((prev) => ({ ...prev, debtToken: e.target.value }))}
                helperText="Choose from configured debt tokens"
                error={Boolean(errors.debtToken)}
                fullWidth
                SelectProps={{ MenuProps: { disablePortal: true } }}
              >
                {debtTokens.length === 0 && <MenuItem value="">No debt tokens configured</MenuItem>}
                <MenuItem value="">-- select debt token --</MenuItem>
                {debtTokens.map((token: DebtTokenConfig) => (
                  <MenuItem key={token.symbol} value={token.address}>
                    {token.symbol}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Collateral"
                value={form.collateralToken}
                onChange={(e) => {
                  const token = e.target.value;
                  const matched = assets.find((a) => a.collateralToken === token);
                  setForm((prev) => ({
                    ...prev,
                    collateralToken: token,
                    oracleAdapter: matched?.oracleAdapter || prev.oracleAdapter
                  }));
                }}
                helperText="Configured collateral addresses"
                error={Boolean(errors.collateralToken)}
                fullWidth
                SelectProps={{ MenuProps: { disablePortal: true } }}
              >
                {assets.length === 0 && <MenuItem value="">No collateral assets configured</MenuItem>}
                <MenuItem value="">-- select collateral --</MenuItem>
                {assets.map((asset) => (
                  <MenuItem key={`${asset.symbol}-col`} value={asset.collateralToken}>
                    {asset.symbol}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Principal"
                value={form.principal}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((prev) => ({ ...prev, principal: val, repaymentAmount: val }));
                }}
                error={Boolean(errors.principal)}
                helperText={errors.principal}
                fullWidth
              />
              <TextField
                label="Collateral amount"
                value={form.minCollateralAmount}
                onChange={handleChange('minCollateralAmount')}
                error={Boolean(errors.minCollateralAmount)}
                helperText={errors.minCollateralAmount}
                fullWidth
              />
            </Stack>
          </Box>
          <Box>
            <Stack spacing={2}>
              <TextField
                select
                label="Maturity"
                value={form.expiryDuration}
                onChange={handleChange('expiryDuration')}
                error={Boolean(errors.expiry)}
                helperText={errors.expiry || 'Relative to now'}
                fullWidth
              >
                <option value="">-- select --</option>
                <option value={60 * 60 * 24}>1 day</option>
                <option value={60 * 60 * 24 * 3}>3 days</option>
                <option value={60 * 60 * 24 * 7}>1 week</option>
                <option value={60 * 60 * 24 * 14}>2 weeks</option>
                <option value={60 * 60 * 24 * 30}>1 month</option>
                <option value={60 * 60 * 24 * 90}>3 months</option>
                <option value={60 * 60 * 24 * 180}>6 months</option>
                <option value={60 * 60 * 24 * 365}>1 year</option>
              </TextField>
              <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 2, backgroundColor: '#f8fafc' }}>
                <Typography variant="subtitle1">Refinance configuration</Typography>
                <Typography variant="body2" color="text.secondary">
                  {appConfig.refi?.enabled
                    ? `Refi preset from env: adapter ${appConfig.refi.adapter}, grace ${appConfig.refi.gracePeriod}s, maxLtv ${appConfig.refi.maxLtvBps} bps`
                    : 'Refinance disabled (set NEXT_PUBLIC_REFI_ENABLED=true to enable)'}
                </Typography>
              </Box>
              <TextField label="Label (optional)" value={form.label} onChange={handleChange('label')} fullWidth />
              <TextField
                label="Notes (optional)"
                value={form.notes}
                onChange={handleChange('notes')}
                fullWidth
                multiline
                minRows={2}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.editableTerms}
                    onChange={(e) => setForm((prev) => ({ ...prev, editableTerms: e.target.checked }))}
                  />
                }
                label="Allow lenders to edit principal/repayment"
              />
            </Stack>
          </Box>
        </Box>
        <Divider sx={{ my: 3 }} />
        <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={2}>
            <Button variant="contained" onClick={handleGenerate}>
              Create RFQ
            </Button>
            <Button variant="outlined" onClick={() => setForm(initialState)}>
              Reset
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Derived expiry (seconds): {expirySeconds || 'N/A'}
          </Typography>
        </Stack>
        {message && (
          <Alert sx={{ mt: 2 }} severity={errors && Object.keys(errors).length ? 'error' : 'success'}>
            {message}
          </Alert>
        )}
        {rfq && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              RFQ preview
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2">RFQ ID: {rfq.rfqId}</Typography>
              <Typography variant="body2">Oracle data hash: {rfq.oracleDataHash}</Typography>
              <Typography variant="body2">Refi config hash: {rfq.refiConfigHash}</Typography>
              <Typography variant="body2">Expiry: {expiryDisplay}</Typography>
            </Stack>
          </Box>
        )}
        <Divider sx={{ my: 3 }} />
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1">Available RFQs (server)</Typography>
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
              <TableCell>Expiry</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rfqs.map((row) => (
              <TableRow key={row.rfqId || row.oracleDataHash} hover>
                <TableCell>{row.metadata?.label || '—'}</TableCell>
                <TableCell sx={{ maxWidth: 200, wordBreak: 'break-all' }}>{row.rfqId}</TableCell>
                <TableCell>{row.borrower}</TableCell>
                <TableCell>{row.principal}</TableCell>
                <TableCell>{row.collateralToken}</TableCell>
                <TableCell>{row.expiry}</TableCell>
              </TableRow>
            ))}
            {rfqs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>{loadingRfqs ? 'Loading…' : 'No RFQs found'}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
