"use client";

import { Box, Tab, Tabs, Typography } from '@mui/material';
import { useState } from 'react';
import RfqBuilder from '../components/RfqBuilder';
import OfferSigner from '../components/OfferSigner';
import LoanOpener from '../components/LoanOpener';

export default function HomePage() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={800}>
        Zero Loans dApp
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Create RFQs, have lenders sign offers, and open loans against collateral via the RFQRouter. Wallet-only, no
        custody or hidden actions.
      </Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Borrower: Create RFQ" />
        <Tab label="Lender: Sign Offer" />
        <Tab label="Borrower: Open Loan" />
      </Tabs>
      {tab === 0 && <RfqBuilder />}
      {tab === 1 && <OfferSigner />}
      {tab === 2 && <LoanOpener />}
    </Box>
  );
}
