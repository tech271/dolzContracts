const MockDolzCrowdsale = artifacts.require('MockDolzCrowdsale');
const DolzToken = artifacts.require('DolzToken');
const LambdaToken = artifacts.require('LambdaToken');

const {
  BN,
  constants,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');
const { MAX_INT256, ZERO_ADDRESS } = constants;
const tenPowerEighteen = new BN(web3.utils.toWei('1', 'ether'), 10);

const deployBasicToken = async (symbol, initialHolder) =>
  LambdaToken.new(symbol, symbol, web3.utils.toWei('1000000', 'ether'), {
    from: initialHolder,
  });

contract('Dolz Crowdsale Supply Limit', (accounts) => {
  let crowdsale;
  let token;
  let usdc;
  let saleStart;
  let saleEnd;
  let withdrawalStart;
  const withdrawPeriodDuration = time.duration.weeks(4).toNumber();
  const withdrawPeriodNumber = 10;
  let authorizedTokens;
  const minBuyValue = new BN(web3.utils.toWei('300', 'ether'), 10);
  const maxTokenAmountPerAddress = new BN(
    web3.utils.toWei('300000', 'ether'),
    10
  );
  const exchangeRate = new BN(50, 10).mul(tenPowerEighteen);
  const referralRewardPercentage = new BN(2, 10);
  const tokenAmountToSell = new BN(web3.utils.toWei('1000000', 'ether'), 10);
  const tokenTotalSupply = tokenAmountToSell
    .mul(new BN(102, 10))
    .div(new BN(100, 10));

  const [owner, user1, user2, wallet, usdt, dai, testToken1, testToken2] =
    accounts;

  beforeEach(async () => {
    usdc = await deployBasicToken('USDC', user1);
    token = await DolzToken.new('Test Token', 'TST', tokenTotalSupply, {
      from: owner,
    });

    const res = await web3.eth.getBlock();
    const now = res.timestamp;
    saleStart = now + time.duration.days(1).toNumber();
    saleEnd = saleStart + time.duration.days(30).toNumber();
    withdrawalStart = saleStart + time.duration.days(90).toNumber();

    authorizedTokens = [usdc.address, usdt, dai];

    crowdsale = await MockDolzCrowdsale.new(
      token.address,
      wallet,
      saleStart,
      saleEnd,
      withdrawalStart,
      withdrawPeriodDuration,
      withdrawPeriodNumber,
      minBuyValue,
      maxTokenAmountPerAddress,
      exchangeRate,
      referralRewardPercentage,
      tokenAmountToSell,
      {
        from: owner,
      }
    );

    await crowdsale.authorizePaymentCurrencies([usdc.address, usdt, dai]);
    // await crowdsale.setSaleStart(saleStart);

    await token.transfer(crowdsale.address, tokenTotalSupply, { from: owner });
    await usdc.approve(crowdsale.address, MAX_INT256, { from: user1 });
  });

  describe('During sale', () => {
    beforeEach(async () => {
      await crowdsale.__increaseTimeFrom(time.duration.days(2));
    });

    describe('Sale', () => {
      it('should not sell if not enough tokens to sell', async () => {
        const amount = new BN(web3.utils.toWei('400', 'ether'));
        const amountValue = amount.mul(exchangeRate).div(tenPowerEighteen);
        await crowdsale.__setSoldAmount(
          tokenAmountToSell.sub(amountValue).add(new BN(1, 10))
        );

        await expectRevert(
          crowdsale.buyToken(usdc.address, amount, ZERO_ADDRESS, {
            from: user1,
          }),
          'DolzCrowdsale: not enough tokens available'
        );
      });

      it('should sell all tokens left', async () => {
        const amount = new BN(web3.utils.toWei('400', 'ether'));
        const amountValue = amount.mul(exchangeRate).div(tenPowerEighteen);
        await crowdsale.__setSoldAmount(tokenAmountToSell.sub(amountValue));

        await crowdsale.buyToken(usdc.address, amount, ZERO_ADDRESS, {
          from: user1,
        });
        const claimableAmount = await crowdsale.getClaimableAmount(user1);

        assert(claimableAmount.eq(amountValue));
      });
    });
  });
});
