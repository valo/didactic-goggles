import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from './providers';
import { AppBar, Box, Container, Toolbar, Typography } from '@mui/material';
import WalletControls from '../components/WalletControls';

export const metadata: Metadata = {
  title: 'Zero Loans dApp',
  description: 'Frontend for RFQ-based zero-cost collateralized loans'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          <AppBar position="sticky" elevation={0} color="inherit" sx={{ borderBottom: '1px solid #e2e8f0' }}>
            <Toolbar sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    px: 1.2,
                    py: 0.6,
                    borderRadius: 1,
                    bgcolor: 'primary.light',
                    color: 'primary.contrastText',
                    fontWeight: 700
                  }}
                >
                  Zero Loans
                </Box>
                <Typography variant="subtitle1" color="text.secondary" fontWeight={700}>
                  RFQ dApp
                </Typography>
              </Box>
              <Box sx={{ flexGrow: 1 }} />
              <WalletControls />
            </Toolbar>
          </AppBar>
          <Container maxWidth="lg" sx={{ py: 6 }}>
            {children}
          </Container>
        </AppProviders>
      </body>
    </html>
  );
}
