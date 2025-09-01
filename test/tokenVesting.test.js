const { expect } = require('chai');
const { ethers } = require('hardhat');

function days(n){ return n * 24 * 60 * 60; }
function months(n){ return n * 30 * 24 * 60 * 60; }

describe('TokenVesting (demo)', function(){
  it('creates schedule, respects cliff, releases linearly, and can revoke', async function(){
    const [admin, user, treasury] = await ethers.getSigners();

    const MockToken = await ethers.getContractFactory('MockToken');
    const token = await MockToken.connect(admin).deploy();
    await token.waitForDeployment();

    const TokenVesting = await ethers.getContractFactory('TokenVesting');
    const vesting = await TokenVesting.deploy(await token.getAddress(), admin.address, treasury.address);
    await vesting.waitForDeployment();

    // approve for pulling
    const total = ethers.parseUnits('1000', 18);
    await (await token.approve(await vesting.getAddress(), total)).wait();

    const start = (await ethers.provider.getBlock('latest')).timestamp + days(1);
    const cliff = months(3);
    const duration = months(12);

    await (await vesting.createSchedule(user.address, total, start, cliff, duration, true)).wait();

    // before start + cliff -> 0 releasable
    await ethers.provider.send('evm_setNextBlockTimestamp', [start + cliff - 10]);
    await ethers.provider.send('evm_mine', []);
    expect(await vesting.releasable(user.address)).to.equal(0n);

    // after cliff, halfway duration -> about 50%
    await ethers.provider.send('evm_setNextBlockTimestamp', [start + (duration / 2)]);
    await ethers.provider.send('evm_mine', []);
    const half = total / 2n;
    const rel = await vesting.releasable(user.address);
    expect(rel).to.be.closeTo(half, ethers.parseUnits('1', 16)); // ~0.01 token tolerance

    // user releases
    const balBefore = await token.balanceOf(user.address);
    await (await vesting.connect(user).release()).wait();
    const balAfter = await token.balanceOf(user.address);
    expect(balAfter - balBefore).to.be.closeTo(half, ethers.parseUnits('1', 16));

    // revoke later: user should get vested remainder; treasury gets refund
    await ethers.provider.send('evm_setNextBlockTimestamp', [start + (duration * 3n) / 4n]);
    await ethers.provider.send('evm_mine', []);
    const vestedAtRevoke = await vesting.vestedAmount(user.address, BigInt(start + Number((duration * 3n) / 4n)));
    const releasedSoFar = (await vesting.getSchedule(user.address)).released;

    await (await vesting.revoke(user.address)).wait();

    const userBal = await token.balanceOf(user.address);
    const treasuryBal = await token.balanceOf(treasury.address);

    const expectedUser = vestedAtRevoke - releasedSoFar;
    const expectedTreasury = total - vestedAtRevoke;

    expect(userBal - balAfter).to.be.closeTo(expectedUser, ethers.parseUnits('1', 16));
    expect(treasuryBal).to.be.closeTo(expectedTreasury, ethers.parseUnits('1', 16));
  });
});
