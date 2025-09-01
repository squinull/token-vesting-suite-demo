# Token Vesting Suite (Demo, EVM)

**Investor/Team vesting demo** built on EVM using Solidity + OpenZeppelin.  
Shows a production-style approach to create token vesting schedules with cliff, linear release, CSV import, revoke, and a minimal claim UI.

> Educational demo. Deploys to any EVM chain (ETH/L2/BSC). Uses OpenZeppelin patterns and Hardhat tests.

## Features
- ✅ Linear vesting with **cliff**, **revocable** schedules and per-beneficiary tracking
- ✅ **CSV importer** script to batch-create schedules
- ✅ **Safe funds flow**: tokens pulled via `safeTransferFrom` (requires allowance)
- ✅ **Release** by beneficiary or admin (`release()` / `releaseFor()`)
- ✅ **Revoke**: unvested tokens returned to treasury, vested portion auto-paid
- ✅ **Events**: `ScheduleCreated`, `TokensReleased`, `ScheduleRevoked`
- ✅ Minimal **claim UI** (static HTML + Ethers) for testnets
- ✅ Tests for cliff, partial release, revoke, and events

## Stack
Solidity ^0.8.20, OpenZeppelin, Hardhat, Ethers, dotenv, csv-parse.  
Gas reporter & coverage ready.

## Quick Start
```bash
git clone https://github.com/squinull/token-vesting-suite-demo.git
cd token-vesting-suite-demo

# install
npm i

# env
cp .env.example .env
# fill PRIVATE_KEY and RPC_URL for your testnet (e.g., Arbitrum/Polygon/Base Sepolia)

# compile + test
npx hardhat compile
npx hardhat test

# deploy mock token + vesting (to default network, from .env)
npx hardhat run scripts/deploy.js --network demo

# create schedules from CSV (data/investors.csv)
# (requires VESTING_ADDRESS and TOKEN_ADDRESS in .env)
node scripts/create_schedules_from_csv.js --network demo
```
## CSV format
`data/investors.csv`
```
address,amount_tokens,start,cliff_months,duration_months,revocable
0x0000000000000000000000000000000000000001,10000,now,6,24,true
0x0000000000000000000000000000000000000002,15000,now,3,18,true
```
- `amount_tokens` is in whole tokens (script converts to 18 decimals).
- `start` can be a UNIX timestamp **or** the literal `now`.

## Minimal Claim UI
Open `frontend/index.html` via a simple HTTP server and connect MetaMask to your testnet.  
- Shows releasable amount for the connected wallet.  
- One-click `Release` calls `release()` on the vesting contract.

## Compliance & Security Notes
- Uses OpenZeppelin **AccessControl**, **ReentrancyGuard**, **SafeERC20**.
- **Treasury** address receives unvested tokens on revoke.
- One schedule per beneficiary in this demo (extendable to multiple).  
- CSV importer requires **token allowance** for the vesting contract (script approves once).

## Project Structure
```
contracts/
  ├─ TokenVesting.sol
  └─ MockToken.sol
scripts/
  ├─ deploy.js
  ├─ create_schedules_from_csv.js
  └─ release_for.js
test/
  └─ tokenVesting.test.js
data/
  └─ investors.csv
frontend/
  └─ index.html
```

## License
MIT © Yehor K
