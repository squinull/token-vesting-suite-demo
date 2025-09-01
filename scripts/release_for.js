const { ethers } = require('hardhat');
require('dotenv').config();

/**
 * Usage:
 * BENEFICIARY=0x... VESTING_ADDRESS=0x... npx hardhat run scripts/release_for.js --network demo
 */
async function main() {
  const beneficiary = process.env.BENEFICIARY;
  const vestingAddr = process.env.VESTING_ADDRESS;
  if (!beneficiary || !vestingAddr) throw new Error('BENEFICIARY and VESTING_ADDRESS required');

  const Vesting = await ethers.getContractFactory('TokenVesting');
  const vesting = Vesting.attach(vestingAddr);
  const tx = await vesting.releaseFor(beneficiary);
  await tx.wait();
  console.log('Released for', beneficiary);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
