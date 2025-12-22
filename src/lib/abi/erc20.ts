export const erc20Abi = [
  {
    type: 'function',
    stateMutability: 'view',
    outputs: [{ type: 'uint8', name: '' }],
    name: 'decimals',
    inputs: []
  },
  {
    type: 'function',
    stateMutability: 'view',
    outputs: [{ type: 'string', name: '' }],
    name: 'symbol',
    inputs: []
  },
  {
    type: 'function',
    stateMutability: 'view',
    outputs: [{ type: 'uint256', name: '' }],
    name: 'allowance',
    inputs: [
      { type: 'address', name: 'owner' },
      { type: 'address', name: 'spender' }
    ]
  },
  {
    type: 'function',
    stateMutability: 'view',
    outputs: [{ type: 'uint256', name: '' }],
    name: 'balanceOf',
    inputs: [{ type: 'address', name: 'owner' }]
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    outputs: [{ type: 'bool', name: '' }],
    name: 'approve',
    inputs: [
      { type: 'address', name: 'spender' },
      { type: 'uint256', name: 'amount' }
    ]
  }
] as const;
