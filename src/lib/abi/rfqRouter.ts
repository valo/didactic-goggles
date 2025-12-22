export const rfqRouterAbi = [
  {
    type: 'function',
    stateMutability: 'view',
    outputs: [{ type: 'bytes32', name: '' }],
    name: 'computeOracleDataHash',
    inputs: [{ type: 'bytes', name: 'oracleData' }]
  },
  {
    type: 'function',
    stateMutability: 'view',
    outputs: [{ type: 'bytes32', name: '' }],
    name: 'computeRefiConfigHash',
    inputs: [{ type: 'bytes', name: 'refiData' }]
  },
  {
    type: 'function',
    stateMutability: 'view',
    outputs: [{ type: 'bytes32', name: '' }],
    name: 'getQuoteDigest',
    inputs: [
      {
        type: 'tuple',
        name: 'quote',
        components: [
          { type: 'address', name: 'lender' },
          { type: 'address', name: 'debtToken' },
          { type: 'address', name: 'collateralToken' },
          { type: 'uint256', name: 'principal' },
          { type: 'uint256', name: 'repaymentAmount' },
          { type: 'uint256', name: 'minCollateralAmount' },
          { type: 'uint256', name: 'expiry' },
          { type: 'uint256', name: 'callStrike' },
          { type: 'uint256', name: 'putStrike' },
          { type: 'address', name: 'oracleAdapter' },
          { type: 'bytes32', name: 'oracleDataHash' },
          { type: 'bytes32', name: 'refiConfigHash' },
          { type: 'uint256', name: 'deadline' },
          { type: 'uint256', name: 'nonce' }
        ]
      }
    ]
  },
  {
    type: 'function',
    stateMutability: 'view',
    outputs: [{ type: 'uint256', name: '' }],
    name: 'previewFee',
    inputs: [
      { type: 'uint256', name: 'principal' },
      { type: 'uint256', name: 'expiry' },
      { type: 'uint256', name: 'atTimestamp' }
    ]
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    outputs: [{ type: 'address', name: 'vault' }],
    name: 'openLoan',
    inputs: [
      {
        type: 'tuple',
        name: 'quote',
        components: [
          { type: 'address', name: 'lender' },
          { type: 'address', name: 'debtToken' },
          { type: 'address', name: 'collateralToken' },
          { type: 'uint256', name: 'principal' },
          { type: 'uint256', name: 'repaymentAmount' },
          { type: 'uint256', name: 'minCollateralAmount' },
          { type: 'uint256', name: 'expiry' },
          { type: 'uint256', name: 'callStrike' },
          { type: 'uint256', name: 'putStrike' },
          { type: 'address', name: 'oracleAdapter' },
          { type: 'bytes32', name: 'oracleDataHash' },
          { type: 'bytes32', name: 'refiConfigHash' },
          { type: 'uint256', name: 'deadline' },
          { type: 'uint256', name: 'nonce' }
        ]
      },
      { type: 'uint256', name: 'collateralAmount' },
      { type: 'bytes', name: 'oracleData' },
      { type: 'bytes', name: 'refiData' },
      { type: 'bytes', name: 'signature' }
    ]
  }
] as const;
