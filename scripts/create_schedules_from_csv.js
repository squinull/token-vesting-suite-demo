const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { ethers } = require('hardhat');
require('dotenv').config();

/**
 * CSV: address,amount_tokens,start,cliff_months,duration_months,revocable
 * amount_tokens in whole tokens (18 decimals assumed)
 * start can be 'now' or unix timestamp
 */
async function main() {
  const vestingAddr = process.env.VESTING_ADDRESS;
  const tokenAddr = process.env.TOKEN_ADDRESS;
  if (!vestingAddr || !tokenAddr) throw new Error('Please set VESTING_ADDRESS and TOKEN_ADDRESS in .env');

  const [caller] = await ethers.getSigners();
  const Token = await ethers.getContractFactory('MockToken');
  const token = Token.attach(tokenAddr);

  const Vesting = await ethers.getContractFactory('TokenVesting');
  const vesting = Vesting.attach(vestingAddr);

  const csv = fs.readFileSync('data/investors.csv', 'utf8');
  const rows = parse(csv, { columns: true, skip_empty_lines: true });

  // Approve once for the total amount
  let total = 0n;
  for (const r of rows) {
    const amt = ethers.parseUnits(String(r.amount_tokens), 18);
    total += amt;
  }
  const currAllow = await token.allowance(caller.address, vestingAddr);
  if (currAllow < total) {
    const tx = await token.approve(vestingAddr, total);
    await tx.wait();
    console.log('Approved total', total.toString());
  }

  for (const r of rows) {
    const beneficiary = r.address.trim();
    const amount = ethers.parseUnits(String(r.amount_tokens), 18);
    const start = (r.start === 'now' || r.start === '') ? Math.floor(Date.now() / 1000) : parseInt(r.start, 10);
    const cliffMonths = parseInt(r.cliff_months, 10);
    const durationMonths = parseInt(r.duration_months, 10);
    const revocable = String(r.revocable).toLowerCase() === 'true';

    // seconds approximation: 30 days per month (demo)
    const cliffSec = cliffMonths * 30 * 24 * 60 * 60;
    const durationSec = durationMonths * 30 * 24 * 60 * 60;

    const tx = await vesting.createSchedule(
      beneficiary,
      amount,
      start,
      cliffSec,
      durationSec,
      revocable
    );
    await tx.wait();
    console.log('Created schedule:', beneficiary, amount.toString());
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
