const TotemCrowdsale = artifacts.require('TotemCrowdsale');
const TotemToken = artifacts.require('TotemToken');
const LambdaToken = artifacts.require('LambdaToken');

const {
  BN,
  constants,
  expectRevert,
  expectEvent,
  time,
} = require('@openzeppelin/test-helpers');
const { MAX_INT256, ZERO_ADDRESS } = constants;

const deployBasicToken = async (symbol, initialHolder) =>
  LambdaToken.new(symbol, symbol, MAX_INT256, {
    from: initialHolder,
  });

const addWeeks = (timestamp, nbWeeks) => {
  return timestamp + time.duration.weeks(nbWeeks).toNumber();
};

contract('Totem Crowdsale Withdrawal', (accounts) => {
  let crowdsale;
  let token;
  let usdc;

  const tokenTotalSupply = new BN(web3.utils.toWei('100000000', 'ether'), 10);

  let withdrawalStart;
  const withdrawPeriodDuration = time.duration.weeks(4).toNumber();
  const withdrawPeriodNumber = new BN(10, 10);
  const minBuyValue = new BN(web3.utils.toWei('300', 'ether'), 10);
  const maxTokenAmountPerAddress = new BN(
    web3.utils.toWei('300000', 'ether'),
    10
  );
  const exchangeRate = new BN(50, 10);
  const referralRewardPercentage = new BN(2, 10);

  const [owner, user1, user2, user3, user4, user5, user6, wallet] = accounts;

  let user1Bought = new BN(web3.utils.toWei('2500', 'ether'), 10);
  let user3Bought = new BN(web3.utils.toWei('459', 'ether'), 10);
  let user4Bought = new BN(web3.utils.toWei('602', 'ether'), 10);
  let user5Bought = new BN(web3.utils.toWei('602', 'ether'), 10);
  let user6Bought = new BN(web3.utils.toWei('300', 'ether'), 10);
  let user1expectsTotalToken = user1Bought.mul(exchangeRate);
  let user3expectsTotalToken = user3Bought.mul(exchangeRate);
  let user4expectsTotalToken = user4Bought.mul(exchangeRate);
  let user5expectsTotalToken = user5Bought.mul(exchangeRate);
  let user6expectsTotalToken = user6Bought.mul(exchangeRate);

  before(async () => {
    usdc = await deployBasicToken('USDC', user1);
    token = await TotemToken.new('Test Token', 'TST', tokenTotalSupply, {
      from: owner,
    });

    const res = await web3.eth.getBlock();
    const now = res.timestamp;
    const saleStart = now + time.duration.days(1).toNumber();
    const saleEnd = saleStart + time.duration.days(30).toNumber();
    withdrawalStart = saleEnd + time.duration.days(60).toNumber();

    const authorizedTokens = [usdc.address];

    crowdsale = await TotemCrowdsale.new(token.address, {
      from: owner,
    });
    await crowdsale.setWallet(wallet);
    await crowdsale.setSaleEnd(saleEnd);
    await crowdsale.setWithdrawalStart(withdrawalStart);
    await crowdsale.setWithdrawPeriodDuration(withdrawPeriodDuration);
    await crowdsale.setWithdrawPeriodNumber(withdrawPeriodNumber);
    await crowdsale.setMinBuyValue(minBuyValue);
    await crowdsale.setMaxTokenAmountPerAddress(maxTokenAmountPerAddress);
    await crowdsale.setExchangeRate(exchangeRate);
    await crowdsale.setReferralRewardPercentage(referralRewardPercentage);
    await crowdsale.authorizePaymentCurrencies(authorizedTokens);
    await crowdsale.setSaleStart(saleStart);

    await token.transfer(crowdsale.address, tokenTotalSupply, { from: owner });
    await usdc.transfer(user3, user3Bought, { from: user1 });
    await usdc.transfer(user4, user4Bought, { from: user1 });
    await usdc.transfer(user5, user4Bought, { from: user1 });
    await usdc.transfer(user6, user6Bought, { from: user1 });
    await usdc.approve(crowdsale.address, MAX_INT256, { from: user1 });
    await usdc.approve(crowdsale.address, MAX_INT256, { from: user3 });
    await usdc.approve(crowdsale.address, MAX_INT256, { from: user4 });
    await usdc.approve(crowdsale.address, MAX_INT256, { from: user5 });
    await usdc.approve(crowdsale.address, MAX_INT256, { from: user6 });

    await time.increaseTo(saleStart);

    await crowdsale.buyToken(usdc.address, user1Bought, ZERO_ADDRESS, {
      from: user1,
    });
    await crowdsale.buyToken(usdc.address, user3Bought, ZERO_ADDRESS, {
      from: user3,
    });
    await crowdsale.buyToken(usdc.address, user4Bought, ZERO_ADDRESS, {
      from: user4,
    });
    await crowdsale.buyToken(usdc.address, user4Bought, ZERO_ADDRESS, {
      from: user5,
    });
    await crowdsale.buyToken(usdc.address, user6Bought, ZERO_ADDRESS, {
      from: user6,
    });
  });

  describe('Before cliff', () => {
    it('should not withdraw', async () => {
      await expectRevert(
        crowdsale.withdrawToken({ from: user1 }),
        'VM Exception while processing transaction: revert'
      );
    });

    it('should return 0 for withdrew amount', async () => {
      const withdrewAmount = await crowdsale.getWithdrewAmount(user1);
      assert(withdrewAmount.eq(new BN(0, 10)));
    });
  });

  describe('At cliff (period 1)', () => {
    before(async () => {
      await time.increaseTo(withdrawalStart);
    });

    it('should withdraw 10%', async () => {
      const expectedWithdrawAmount =
        user1expectsTotalToken.div(withdrawPeriodNumber);
      const userInitialBalance = await token.balanceOf(user1);
      const crowdsaleInitialBalance = await token.balanceOf(crowdsale.address);

      const receipt = await crowdsale.withdrawToken({ from: user1 });

      const userFinalBalance = await token.balanceOf(user1);
      const crowdsaleFinalBalance = await token.balanceOf(crowdsale.address);
      const withdrewAmount = await crowdsale.getWithdrewAmount(user1);

      expectEvent(receipt, 'TokenWithdrew', {
        account: user1,
        amount: expectedWithdrawAmount,
      });
      assert(
        userFinalBalance.sub(userInitialBalance).eq(expectedWithdrawAmount)
      );
      assert(
        crowdsaleInitialBalance
          .sub(crowdsaleFinalBalance)
          .eq(expectedWithdrawAmount)
      );
      assert(withdrewAmount.eq(expectedWithdrawAmount));
    });

    it('should not withdraw twice', async () => {
      const userInitialBalance = await token.balanceOf(user1);
      const crowdsaleInitialBalance = await token.balanceOf(crowdsale.address);

      await crowdsale.withdrawToken({ from: user1 });

      const userFinalBalance = await token.balanceOf(user1);
      const crowdsaleFinalBalance = await token.balanceOf(crowdsale.address);

      assert(userFinalBalance.sub(userInitialBalance).eq(new BN(0, 10)));
      assert(
        crowdsaleInitialBalance.sub(crowdsaleFinalBalance).eq(new BN(0, 10))
      );
    });

    it('should withdraw nothing if nothing claimable', async () => {
      const userInitialBalance = await token.balanceOf(user2);
      await crowdsale.withdrawToken({ from: user2 });
      const userFinalBalance = await token.balanceOf(user2);

      assert(userFinalBalance.sub(userInitialBalance).eq(new BN(0, 10)));
    });
  });

  describe('At cliff + 4 weeks (period 2)', () => {
    before(async () => {
      await time.increaseTo(addWeeks(withdrawalStart, 4));
    });

    it('should withdraw 10% more at 2nd withdraw', async () => {
      const expectedWithdrawAmount =
        user1expectsTotalToken.div(withdrawPeriodNumber);
      const userInitialBalance = await token.balanceOf(user1);
      const crowdsaleInitialBalance = await token.balanceOf(crowdsale.address);

      const receipt = await crowdsale.withdrawToken({ from: user1 });

      const userFinalBalance = await token.balanceOf(user1);
      const crowdsaleFinalBalance = await token.balanceOf(crowdsale.address);
      const withdrewAmount = await crowdsale.getWithdrewAmount(user1);

      expectEvent(receipt, 'TokenWithdrew', {
        account: user1,
        amount: expectedWithdrawAmount,
      });
      assert(
        userFinalBalance.sub(userInitialBalance).eq(expectedWithdrawAmount)
      );
      assert(
        crowdsaleInitialBalance
          .sub(crowdsaleFinalBalance)
          .eq(expectedWithdrawAmount)
      );
      assert(withdrewAmount.eq(expectedWithdrawAmount.mul(new BN(2, 10))));
    });

    it('should not withdraw twice', async () => {
      const userInitialBalance = await token.balanceOf(user1);
      const crowdsaleInitialBalance = await token.balanceOf(crowdsale.address);

      await crowdsale.withdrawToken({ from: user1 });

      const userFinalBalance = await token.balanceOf(user1);
      const crowdsaleFinalBalance = await token.balanceOf(crowdsale.address);

      assert(userFinalBalance.sub(userInitialBalance).eq(new BN(0, 10)));
      assert(
        crowdsaleInitialBalance.sub(crowdsaleFinalBalance).eq(new BN(0, 10))
      );
    });

    it('should withdraw 20%', async () => {
      const expectedWithdrawAmount = user3expectsTotalToken
        .div(withdrawPeriodNumber)
        .mul(new BN(2, 10));
      const userInitialBalance = await token.balanceOf(user3);
      const crowdsaleInitialBalance = await token.balanceOf(crowdsale.address);

      const receipt = await crowdsale.withdrawToken({ from: user3 });

      const userFinalBalance = await token.balanceOf(user3);
      const crowdsaleFinalBalance = await token.balanceOf(crowdsale.address);

      expectEvent(receipt, 'TokenWithdrew', {
        account: user3,
        amount: expectedWithdrawAmount,
      });
      assert(
        userFinalBalance.sub(userInitialBalance).eq(expectedWithdrawAmount)
      );
      assert(
        crowdsaleInitialBalance
          .sub(crowdsaleFinalBalance)
          .eq(expectedWithdrawAmount)
      );
    });
  });

  describe('At cliff + 8 weeks (period 3)', () => {
    before(async () => {
      await time.increaseTo(addWeeks(withdrawalStart, 8));
    });

    it('should withdraw 10% more at 3rd withdraw', async () => {
      const expectedWithdrawAmount =
        user1expectsTotalToken.div(withdrawPeriodNumber);
      const userInitialBalance = await token.balanceOf(user1);
      const crowdsaleInitialBalance = await token.balanceOf(crowdsale.address);

      const receipt = await crowdsale.withdrawToken({ from: user1 });

      const userFinalBalance = await token.balanceOf(user1);
      const crowdsaleFinalBalance = await token.balanceOf(crowdsale.address);

      expectEvent(receipt, 'TokenWithdrew', {
        account: user1,
        amount: expectedWithdrawAmount,
      });
      assert(
        userFinalBalance.sub(userInitialBalance).eq(expectedWithdrawAmount)
      );
      assert(
        crowdsaleInitialBalance
          .sub(crowdsaleFinalBalance)
          .eq(expectedWithdrawAmount)
      );
    });

    it('should withdraw 10% more at 2nd withdraw', async () => {
      const expectedWithdrawAmount =
        user3expectsTotalToken.div(withdrawPeriodNumber);
      const userInitialBalance = await token.balanceOf(user3);
      const crowdsaleInitialBalance = await token.balanceOf(crowdsale.address);

      const receipt = await crowdsale.withdrawToken({ from: user3 });

      const userFinalBalance = await token.balanceOf(user3);
      const crowdsaleFinalBalance = await token.balanceOf(crowdsale.address);

      expectEvent(receipt, 'TokenWithdrew', {
        account: user3,
        amount: expectedWithdrawAmount,
      });

      assert(
        userFinalBalance.sub(userInitialBalance).eq(expectedWithdrawAmount)
      );
      assert(
        crowdsaleInitialBalance
          .sub(crowdsaleFinalBalance)
          .eq(expectedWithdrawAmount)
      );
    });

    it('should withdraw 30%', async () => {
      const expectedWithdrawAmount = user4expectsTotalToken
        .div(withdrawPeriodNumber)
        .mul(new BN(3, 10));
      const userInitialBalance = await token.balanceOf(user4);
      const crowdsaleInitialBalance = await token.balanceOf(crowdsale.address);

      const receipt = await crowdsale.withdrawToken({ from: user4 });

      const userFinalBalance = await token.balanceOf(user4);
      const crowdsaleFinalBalance = await token.balanceOf(crowdsale.address);

      expectEvent(receipt, 'TokenWithdrew', {
        account: user4,
        amount: expectedWithdrawAmount,
      });
      assert(
        userFinalBalance.sub(userInitialBalance).eq(expectedWithdrawAmount)
      );
      assert(
        crowdsaleInitialBalance
          .sub(crowdsaleFinalBalance)
          .eq(expectedWithdrawAmount)
      );
    });
  });

  describe('At cliff + 36 weeks (period 10)', () => {
    before(async () => {
      await time.increaseTo(addWeeks(withdrawalStart, 36));
    });

    it('should withdraw 100%', async () => {
      const userInitialBalance = await token.balanceOf(user5);
      const crowdsaleInitialBalance = await token.balanceOf(crowdsale.address);

      const receipt = await crowdsale.withdrawToken({ from: user5 });

      const userFinalBalance = await token.balanceOf(user5);
      const crowdsaleFinalBalance = await token.balanceOf(crowdsale.address);

      expectEvent(receipt, 'TokenWithdrew', {
        account: user5,
        amount: user5expectsTotalToken,
      });
      assert(
        userFinalBalance.sub(userInitialBalance).eq(user5expectsTotalToken)
      );
      assert(
        crowdsaleInitialBalance
          .sub(crowdsaleFinalBalance)
          .eq(user5expectsTotalToken)
      );
    });

    it('should withdraw rest', async () => {
      const expectedWithdrawAmount = user1expectsTotalToken
        .div(withdrawPeriodNumber)
        .mul(new BN(7, 10));
      const userInitialBalance = await token.balanceOf(user1);
      const crowdsaleInitialBalance = await token.balanceOf(crowdsale.address);

      const receipt = await crowdsale.withdrawToken({ from: user1 });

      const userFinalBalance = await token.balanceOf(user1);
      const crowdsaleFinalBalance = await token.balanceOf(crowdsale.address);

      expectEvent(receipt, 'TokenWithdrew', {
        account: user1,
        amount: expectedWithdrawAmount,
      });

      assert(userFinalBalance.eq(user1expectsTotalToken));
      assert(
        userFinalBalance.sub(userInitialBalance).eq(expectedWithdrawAmount)
      );
      assert(
        crowdsaleInitialBalance
          .sub(crowdsaleFinalBalance)
          .eq(expectedWithdrawAmount)
      );
    });
  });

  describe('At cliff + 40 weeks (after period 10)', () => {
    before(async () => {
      await time.increaseTo(addWeeks(withdrawalStart, 40));
    });

    it('should withdraw 100%', async () => {
      const userInitialBalance = await token.balanceOf(user6);
      const crowdsaleInitialBalance = await token.balanceOf(crowdsale.address);

      const receipt = await crowdsale.withdrawToken({ from: user6 });

      const userFinalBalance = await token.balanceOf(user6);
      const crowdsaleFinalBalance = await token.balanceOf(crowdsale.address);

      expectEvent(receipt, 'TokenWithdrew', {
        account: user6,
        amount: user6expectsTotalToken,
      });
      assert(
        userFinalBalance.sub(userInitialBalance).eq(user6expectsTotalToken)
      );
      assert(
        crowdsaleInitialBalance
          .sub(crowdsaleFinalBalance)
          .eq(user6expectsTotalToken)
      );
    });

    it('should not withdraw if already withdrew everything', async () => {
      const userInitialBalance = await token.balanceOf(user6);
      await crowdsale.withdrawToken({ from: user6 });
      const userFinalBalance = await token.balanceOf(user6);

      assert(userFinalBalance.sub(userInitialBalance).eq(new BN(0, 10)));
    });

    it('should withdraw rest', async () => {
      const expectedWithdrawAmount = user3expectsTotalToken
        .div(withdrawPeriodNumber)
        .mul(new BN(7, 10));
      const userInitialBalance = await token.balanceOf(user3);
      const crowdsaleInitialBalance = await token.balanceOf(crowdsale.address);

      const receipt = await crowdsale.withdrawToken({ from: user3 });

      const userFinalBalance = await token.balanceOf(user3);
      const crowdsaleFinalBalance = await token.balanceOf(crowdsale.address);

      expectEvent(receipt, 'TokenWithdrew', {
        account: user3,
        amount: expectedWithdrawAmount,
      });

      assert(userFinalBalance.eq(user3expectsTotalToken));
      assert(
        userFinalBalance.sub(userInitialBalance).eq(expectedWithdrawAmount)
      );
      assert(
        crowdsaleInitialBalance
          .sub(crowdsaleFinalBalance)
          .eq(expectedWithdrawAmount)
      );
    });
  });
});
