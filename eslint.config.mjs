import nextConfig from 'eslint-config-next';

const config = [
  {
    ignores: ['node_modules', '.next', 'dist', 'coverage']
  },
  ...nextConfig
];

export default config;
