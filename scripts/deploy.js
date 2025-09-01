const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);

  // 1) Deploy mock token
  const MockToken = await ethers.getContractFactory('MockToken');
  const token = await MockToken.deploy();
  await token.deployed();
  console.log('MockToken:', token.address);

  // 2) Deploy vesting with deployer as admin & treasury
  const TokenVesting = await ethers.getContractFactory('TokenVesting');
  const vesting = await TokenVesting.deploy(token.address, deployer.address, deployer.address);
  await vesting.deployed();
  console.log('TokenVesting:', vesting.address);

  // Approve vesting to pull tokens for future schedules (approve a big allowance for demo)
  const allowance = ethers.parseUnits('500000', 18);
  await (await token.approve(vesting.address, allowance)).wait();
  console.log('Approved', allowance.toString(), 'to vesting');

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
