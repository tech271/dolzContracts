const TotemCrowdsale = artifacts.require('TotemCrowdsale');
const TotemToken = artifacts.require('TotemToken');
const LambdaToken = artifacts.require('LambdaToken');

const {
  BN,
  constants,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');
const { MAX_INT256, ZERO_ADDRESS } = constants;
const { web3 } = require('@openzeppelin/test-helpers/src/setup');

const deployBasicToken = async (symbol, initialHolder) =>
  LambdaToken.new(symbol, symbol, web3.utils.toWei('1000000', 'ether'), {
    from: initialHolder,
  });

contract('Totem Crowdsale Supply Limit', (accounts) => {
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
  const exchangeRate = new BN(50, 10);
  const referralRewardPercentage = new BN(2, 10);
  const tokenTotalSupply = new BN(web3.utils.toWei('100000', 'ether'), 10);

  const [owner, user1, user2, wallet, usdt, dai, testToken1, testToken2] =
    accounts;

  beforeEach(async () => {
    usdc = await deployBasicToken('USDC', user1);
    token = await TotemToken.new('Test Token', 'TST', tokenTotalSupply, {
      from: owner,
    });

    const res = await web3.eth.getBlock();
    const now = res.timestamp;
    saleStart = now + time.duration.days(1).toNumber();
    saleEnd = saleStart + time.duration.days(30).toNumber();
    withdrawalStart = saleStart + time.duration.days(90).toNumber();

    authorizedTokens = [usdc.address, usdt, dai];

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
    await crowdsale.authorizePaymentCurrencies([usdc.address, usdt, dai]);
    await crowdsale.setSaleStart(saleStart);

    await token.transfer(crowdsale.address, tokenTotalSupply, { from: owner });
    await usdc.approve(crowdsale.address, MAX_INT256, { from: user1 });
  });

  describe('During sale', () => {
    before(async () => {
      await time.increase(time.duration.days(2));
    });

    describe('Sale', () => {
      it('should not sell if not enough supply', async () => {
        const crowdsaleBalance = await token.balanceOf(crowdsale.address);
        const crowdsaleBalanceValue = crowdsaleBalance.div(exchangeRate);

        await expectRevert(
          crowdsale.buyToken(
            usdc.address,
            crowdsaleBalanceValue.add(new BN(1, 10)),
            ZERO_ADDRESS,
            {
              from: user1,
            }
          ),
          'TotemCrowdsale: not enough tokens available'
        );
      });

      it('should sell all tokens left', async () => {
        const tokenTotalSupplyValue = tokenTotalSupply.div(exchangeRate);
        await crowdsale.buyToken(
          usdc.address,
          tokenTotalSupplyValue,
          ZERO_ADDRESS,
          {
            from: user1,
          }
        );
        const claimableAmount = await crowdsale.getClaimableAmount(user1);

        assert(claimableAmount.eq(tokenTotalSupply));
      });
    });

    describe('Referral', () => {
      it('should not sell if not enough supply for referral', async () => {
        await crowdsale.registerAsReferral({ from: user2 });

        const crowdsaleBalance = await token.balanceOf(crowdsale.address);
        const supplyLeftValue = crowdsaleBalance.div(exchangeRate);

        await expectRevert(
          crowdsale.buyToken(usdc.address, supplyLeftValue, user2, {
            from: user1,
          }),
          'TotemCrowdsale: not enough tokens available'
        );
      });
    });
  });
});
