require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');
require('hardhat-gas-reporter');

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.20',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: {},
    demo: {
      url: RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : undefined,
    },
  },
  gasReporter: {
    enabled: true,
    currency: 'USD',
    excludeContracts: ['MockToken'],
  },
};
