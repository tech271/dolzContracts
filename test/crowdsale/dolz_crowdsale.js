const MockDolzCrowdsale = artifacts.require('MockDolzCrowdsale');
const DolzToken = artifacts.require('DolzToken');
const LambdaToken = artifacts.require('LambdaToken');

const {
  BN,
  constants,
  expectRevert,
  expectEvent,
  time,
} = require('@openzeppelin/test-helpers');
const { MAX_INT256, ZERO_ADDRESS } = constants;
const tenPowerEighteen = new BN(web3.utils.toWei('1', 'ether'), 10);

const deployBasicToken = async (symbol, initialHolder) =>
  LambdaToken.new(symbol, symbol, web3.utils.toWei('1000000', 'ether'), {
    from: initialHolder,
  });

contract('Dolz Crowdsale', (accounts) => {
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

  const [
    owner,
    user1,
    user2,
    user3,
    wallet,
    usdt,
    dai,
    testToken1,
    testToken2,
  ] = accounts;

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

    await token.transfer(crowdsale.address, tokenTotalSupply, { from: owner });
    await usdc.approve(crowdsale.address, MAX_INT256, { from: user1 });
  });

  describe('Initialisation', () => {
    it('should initialize with passed values', async () => {
      const saleSettings = await crowdsale.getSaleSettings();

      assert(saleSettings.token === token.address, 'Wrong token');
      assert(saleSettings.wallet === wallet, 'Wrong wallet');
      assert(parseInt(saleSettings.saleStart) === saleStart, 'Wrong saleStart');
      assert(parseInt(saleSettings.saleEnd) === saleEnd, 'Wrong saleEnd');
      assert(
        parseInt(saleSettings.withdrawalStart) === withdrawalStart,
        'Wrong withdrawalStart'
      );
      assert(
        parseInt(saleSettings.withdrawPeriodDuration) ===
          withdrawPeriodDuration,
        'Wrong withdrawPeriodDuration'
      );
      assert(
        parseInt(saleSettings.withdrawPeriodNumber) === withdrawPeriodNumber,
        'Wrong withdrawPeriodNumber'
      );
      assert(
        new BN(saleSettings.minBuyValue).eq(minBuyValue),
        'Wrong minBuyValue'
      );
      assert(
        new BN(saleSettings.maxTokenAmountPerAddress).eq(
          maxTokenAmountPerAddress
        ),
        'Wrong maxTokenAmountPerAddress'
      );
      assert(
        new BN(saleSettings.exchangeRate).eq(exchangeRate),
        'Wrong exchangeRate'
      );
      assert(
        new BN(saleSettings.referralRewardPercentage).eq(
          referralRewardPercentage
        ),
        'Wrong referralRewardPercentage'
      );
      assert(
        new BN(saleSettings.amountToSell).eq(tokenAmountToSell),
        'Wrong amountToSell'
      );
    });

    it('should authorize payment currencies', async () => {
      authorizedTokens.forEach(async (token) => {
        const isAuthorized = await crowdsale.isAuthorizedPaymentCurrency(token);
        assert(isAuthorized === true);
      });
    });
  });

  describe('Before sale', () => {
    describe('Sale', () => {
      it('should not allow buying before sale start', async () => {
        await expectRevert(
          crowdsale.buyToken(usdc.address, '100', ZERO_ADDRESS, {
            from: user1,
          }),
          'DolzCrowdsale: sale not started yet'
        );
      });
    });

    describe('Setters', () => {
      it('should update wallet', async () => {
        const receipt = await crowdsale.setWallet(owner, { from: owner });
        const saleSettings = await crowdsale.getSaleSettings();

        expectEvent(receipt, 'WalletUpdated', {
          newWallet: owner,
          updater: owner,
        });
        assert(saleSettings.wallet === owner);
      });

      it('should not update wallet if not owner', async () => {
        await expectRevert(
          crowdsale.setWallet(user1, { from: user1 }),
          'Ownable: caller is not the owner'
        );
      });

      it('should update sale start', async () => {
        const newSaleStart = saleStart + 100000000;
        const receipt = await crowdsale.setSaleStart(newSaleStart, {
          from: owner,
        });
        const saleSettings = await crowdsale.getSaleSettings();

        expectEvent(receipt, 'SaleStartUpdated', {
          newSaleStart: new BN(newSaleStart, 10),
          updater: owner,
        });
        assert(parseInt(saleSettings.saleStart) === newSaleStart);
      });

      it('should update sale start if not initialized', async () => {
        localCrowdsale = await MockDolzCrowdsale.new(
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
        const receipt = await localCrowdsale.setSaleStart(saleStart, {
          from: owner,
        });
        const saleSettings = await localCrowdsale.getSaleSettings();

        expectEvent(receipt, 'SaleStartUpdated', {
          newSaleStart: new BN(saleStart, 10),
          updater: owner,
        });
        assert(parseInt(saleSettings.saleStart) === saleStart);
      });

      it('should not update sale start if not owner', async () => {
        await expectRevert(
          crowdsale.setSaleStart(saleStart + 100000000, {
            from: user1,
          }),
          'Ownable: caller is not the owner'
        );
      });

      it('should update sale end', async () => {
        const newSaleEnd = saleStart + 100000000;
        const receipt = await crowdsale.setSaleEnd(newSaleEnd, { from: owner });
        const saleSettings = await crowdsale.getSaleSettings();

        expectEvent(receipt, 'SaleEndUpdated', {
          newSaleEnd: new BN(newSaleEnd, 10),
          updater: owner,
        });
        assert(parseInt(saleSettings.saleEnd) === newSaleEnd);
      });

      it('should not update sale end if not owner', async () => {
        await expectRevert(
          crowdsale.setSaleEnd(saleStart + 100000000, { from: user1 }),
          'Ownable: caller is not the owner'
        );
      });

      it('should update withdrawal start', async () => {
        const newWithdrawalStart = saleStart + 100000000;
        const receipt = await crowdsale.setWithdrawalStart(newWithdrawalStart, {
          from: owner,
        });
        const saleSettings = await crowdsale.getSaleSettings();

        expectEvent(receipt, 'WithdrawalStartUpdated', {
          newWithdrawalStart: new BN(newWithdrawalStart, 10),
          updater: owner,
        });
        assert(parseInt(saleSettings.withdrawalStart) === newWithdrawalStart);
      });

      it('should not update withdrawal start if not owner', async () => {
        await expectRevert(
          crowdsale.setWithdrawalStart(saleStart + 100000000, {
            from: user1,
          }),
          'Ownable: caller is not the owner'
        );
      });

      it('should update withdraw period duration', async () => {
        const newWithdrawPeriodDuration = time.duration.weeks(4);
        const receipt = await crowdsale.setWithdrawPeriodDuration(
          newWithdrawPeriodDuration,
          { from: owner }
        );
        const saleSettings = await crowdsale.getSaleSettings();

        expectEvent(receipt, 'WithdrawPeriodDurationUpdated', {
          newWithdrawPeriodDuration,
          updater: owner,
        });
        assert(
          parseInt(saleSettings.withdrawPeriodDuration) ===
            newWithdrawPeriodDuration.toNumber()
        );
      });

      it('should not update withdraw period duration if not owner', async () => {
        await expectRevert(
          crowdsale.setWithdrawPeriodDuration(time.duration.weeks(4), {
            from: user1,
          }),
          'Ownable: caller is not the owner'
        );
      });

      it('should update withdraw period number', async () => {
        const newWithdrawPeriodNumber = 6;
        const receipt = await crowdsale.setWithdrawPeriodNumber(
          newWithdrawPeriodNumber,
          { from: owner }
        );
        const saleSettings = await crowdsale.getSaleSettings();

        expectEvent(receipt, 'WithdrawPeriodNumberUpdated', {
          newWithdrawPeriodNumber: new BN(newWithdrawPeriodNumber, 10),
          updater: owner,
        });
        assert(
          parseInt(saleSettings.withdrawPeriodNumber) ===
            newWithdrawPeriodNumber
        );
      });

      it('should not update withdraw period number if not owner', async () => {
        await expectRevert(
          crowdsale.setWithdrawPeriodNumber(2, {
            from: user1,
          }),
          'Ownable: caller is not the owner'
        );
      });

      it('should update minimum buy value', async () => {
        const newMinBuyValue = 1000;
        const receipt = await crowdsale.setMinBuyValue(newMinBuyValue, {
          from: owner,
        });
        const saleSettings = await crowdsale.getSaleSettings();

        expectEvent(receipt, 'MinBuyValueUpdated', {
          newMinBuyValue: new BN(newMinBuyValue, 10),
          updater: owner,
        });
        assert(parseInt(saleSettings.minBuyValue) === newMinBuyValue);
      });

      it('should not update minimum buy value if not owner', async () => {
        await expectRevert(
          crowdsale.setMinBuyValue(200, {
            from: user1,
          }),
          'Ownable: caller is not the owner'
        );
      });

      it('should update maximum token amount per address', async () => {
        const newMaxTokenAmountPerAddress = 3000;
        const receipt = await crowdsale.setMaxTokenAmountPerAddress(
          newMaxTokenAmountPerAddress,
          {
            from: owner,
          }
        );
        const saleSettings = await crowdsale.getSaleSettings();

        expectEvent(receipt, 'MaxTokenAmountPerAddressUpdated', {
          newMaxTokenAmountPerAddress: new BN(newMaxTokenAmountPerAddress, 10),
          updater: owner,
        });
        assert(
          parseInt(saleSettings.maxTokenAmountPerAddress) ===
            newMaxTokenAmountPerAddress
        );
      });

      it('should not update maximum token amount per address if not owner', async () => {
        await expectRevert(
          crowdsale.setMaxTokenAmountPerAddress(250, {
            from: user1,
          }),
          'Ownable: caller is not the owner'
        );
      });

      it('should update exchange rate', async () => {
        const newExchangeRate = 200;
        const receipt = await crowdsale.setExchangeRate(newExchangeRate, {
          from: owner,
        });
        const saleSettings = await crowdsale.getSaleSettings();

        expectEvent(receipt, 'ExchangeRateUpdated', {
          newExchangeRate: new BN(newExchangeRate, 10),
          updater: owner,
        });
        assert(parseInt(saleSettings.exchangeRate) === newExchangeRate);
      });

      it('should not update exchange rate if not owner', async () => {
        await expectRevert(
          crowdsale.setExchangeRate(8, {
            from: user1,
          }),
          'Ownable: caller is not the owner'
        );
      });

      it('should update referral reward percentage', async () => {
        const newReferralRewardPercentage = 5;
        const receipt = await crowdsale.setReferralRewardPercentage(
          newReferralRewardPercentage,
          {
            from: owner,
          }
        );
        const saleSettings = await crowdsale.getSaleSettings();

        expectEvent(receipt, 'ReferralRewardPercentageUpdated', {
          newReferralRewardPercentage: new BN(newReferralRewardPercentage, 10),
          updater: owner,
        });
        assert(
          parseInt(saleSettings.referralRewardPercentage) ===
            newReferralRewardPercentage
        );
      });

      it('should not update referral reward percentage if not owner', async () => {
        await expectRevert(
          crowdsale.setReferralRewardPercentage(6, {
            from: user1,
          }),
          'Ownable: caller is not the owner'
        );
      });

      it('should update amountToSell', async () => {
        const newAmountToSell = 5000;
        const receipt = await crowdsale.setAmountToSell(newAmountToSell, {
          from: owner,
        });
        const saleSettings = await crowdsale.getSaleSettings();

        expectEvent(receipt, 'AmountToSellUpdated', {
          newAmountToSell: new BN(newAmountToSell, 10),
          updater: owner,
        });
        assert(parseInt(saleSettings.amountToSell) === newAmountToSell);
      });

      it('should not update amountToSell if not owner', async () => {
        await expectRevert(
          crowdsale.setAmountToSell(500, {
            from: user1,
          }),
          'Ownable: caller is not the owner'
        );
      });

      it('should authorize one token', async () => {
        const receipt = await crowdsale.authorizePaymentCurrencies(
          [testToken1],
          {
            from: owner,
          }
        );
        expectEvent(receipt, 'PaymentCurrenciesAuthorized', {
          tokens: [testToken1],
          updater: owner,
        });
      });

      it('should authorize several tokens', async () => {
        const receipt = await crowdsale.authorizePaymentCurrencies(
          [testToken1, testToken2],
          {
            from: owner,
          }
        );
        expectEvent(receipt, 'PaymentCurrenciesAuthorized', {
          tokens: [testToken1, testToken2],
          updater: owner,
        });
      });

      it('should not authorize token if not owner', async () => {
        await expectRevert(
          crowdsale.authorizePaymentCurrencies([testToken1], {
            from: user1,
          }),
          'Ownable: caller is not the owner'
        );
      });
    });
  });

  describe('During sale', () => {
    beforeEach(async () => {
      await crowdsale.__increaseTimeFrom(time.duration.days(2));
    });

    describe('Setters', () => {
      it('should not update sale start after sale started', async () => {
        await expectRevert(
          crowdsale.setSaleStart(saleStart + 100000000),
          'DolzCrowdsale: sale already started'
        );
      });

      it('should not update sale end after sale started', async () => {
        await expectRevert(
          crowdsale.setSaleEnd(saleStart + 100000000),
          'DolzCrowdsale: sale already started'
        );
      });

      it('should not update withdrawal start after sale started', async () => {
        await expectRevert(
          crowdsale.setWithdrawalStart(saleStart + 100000000),
          'DolzCrowdsale: sale already started'
        );
      });

      it('should not update withdraw period duration after sale started', async () => {
        await expectRevert(
          crowdsale.setWithdrawPeriodDuration(time.duration.weeks(4)),
          'DolzCrowdsale: sale already started'
        );
      });

      it('should not update withdraw period number after sale started', async () => {
        await expectRevert(
          crowdsale.setWithdrawPeriodDuration(6),
          'DolzCrowdsale: sale already started'
        );
      });

      it('should not update minimum buy value after sale started', async () => {
        await expectRevert(
          crowdsale.setMinBuyValue(300),
          'DolzCrowdsale: sale already started'
        );
      });

      it('should not update maximum buy value after sale started', async () => {
        await expectRevert(
          crowdsale.setMaxTokenAmountPerAddress(1000),
          'DolzCrowdsale: sale already started'
        );
      });

      it('should not update exchange rate after sale started', async () => {
        await expectRevert(
          crowdsale.setExchangeRate(78),
          'DolzCrowdsale: sale already started'
        );
      });

      it('should not update referral reward percentage after sale started', async () => {
        await expectRevert(
          crowdsale.setReferralRewardPercentage(5),
          'DolzCrowdsale: sale already started'
        );
      });

      it('should not update amount to sell after sale started', async () => {
        await expectRevert(
          crowdsale.setAmountToSell(500),
          'DolzCrowdsale: sale already started'
        );
      });

      it('should not authorize token after sale started', async () => {
        await expectRevert(
          crowdsale.authorizePaymentCurrencies([testToken1]),
          'DolzCrowdsale: sale already started'
        );
      });
    });

    describe('Sale', () => {
      it('should sell Dolz token', async () => {
        const value = new BN(web3.utils.toWei('300', 'ether'), 10);
        const expectedTokenAmount = value
          .mul(exchangeRate)
          .div(tenPowerEighteen);

        const receipt = await crowdsale.buyToken(
          usdc.address,
          value,
          ZERO_ADDRESS,
          {
            from: user1,
          }
        );

        const claimableAmount = await crowdsale.getClaimableAmount(user1);
        let soldAmount = await crowdsale.getSoldAmount();
        const walletUsdcBalance = await usdc.balanceOf(wallet);

        expectEvent(receipt, 'TokenBought', {
          account: user1,
          stableCoin: usdc.address,
          value,
          referral: ZERO_ADDRESS,
        });
        assert(claimableAmount.eq(expectedTokenAmount));
        assert(new BN(soldAmount, 10).eq(expectedTokenAmount));
        assert(walletUsdcBalance.eq(value));

        await crowdsale.buyToken(usdc.address, value, ZERO_ADDRESS, {
          from: user1,
        });
        soldAmount = await crowdsale.getSoldAmount();

        assert(
          new BN(soldAmount, 10).eq(expectedTokenAmount.mul(new BN(2, 10)))
        );
      });

      it('should not sell if under minimum buy value', async () => {
        await expectRevert(
          crowdsale.buyToken(
            usdc.address,
            minBuyValue.div(new BN(2, 10)),
            ZERO_ADDRESS,
            {
              from: user1,
            }
          ),
          'DolzCrowdsale: under minimum buy value'
        );
      });

      it('should not sell if above maximum token amount per address in one time', async () => {
        await expectRevert(
          crowdsale.buyToken(
            usdc.address,
            maxTokenAmountPerAddress
              .mul(tenPowerEighteen)
              .div(exchangeRate)
              .mul(new BN(2, 10)),
            ZERO_ADDRESS,
            {
              from: user1,
            }
          ),
          'DolzCrowdsale: above maximum token amount per address'
        );
      });

      it('should not sell if above maximum token amount per address in multiple times', async () => {
        await crowdsale.buyToken(
          usdc.address,
          maxTokenAmountPerAddress.mul(tenPowerEighteen).div(exchangeRate),
          ZERO_ADDRESS,
          {
            from: user1,
          }
        );

        await expectRevert(
          crowdsale.buyToken(usdc.address, 1, ZERO_ADDRESS, {
            from: user1,
          }),
          'DolzCrowdsale: under minimum buy value'
        );
      });

      it('should not sell if user funds insufficient', async () => {
        await usdc.approve(crowdsale.address, MAX_INT256, { from: user3 });

        await expectRevert(
          crowdsale.buyToken(
            usdc.address,
            web3.utils.toWei('300', 'ether'),
            ZERO_ADDRESS,
            {
              from: user3,
            }
          ),
          'ERC20: transfer amount exceeds balance'
        );

        const res = await crowdsale.getClaimableAmount(user3);
        assert(res.eq(new BN(0, 10)));
      });

      it('should not accept random token', async () => {
        const randomToken = await deployBasicToken('RDM', user1);

        await randomToken.approve(crowdsale.address, MAX_INT256, {
          from: user1,
        });
        await expectRevert(
          crowdsale.buyToken(randomToken.address, '100', ZERO_ADDRESS, {
            from: user1,
          }),
          'DolzCrowdsale: unauthorized token'
        );
      });
    });

    describe('Referral', () => {
      it('should apply referral reward', async () => {
        const value = new BN(web3.utils.toWei('400', 'ether'), 10);
        const expectedTokenAmount = value
          .mul(exchangeRate)
          .div(tenPowerEighteen);
        const expectedReferralAmount = expectedTokenAmount
          .mul(referralRewardPercentage)
          .div(new BN(100, 10));

        const initialClaimableAmount = await crowdsale.getClaimableAmount(
          user2
        );
        const receipt = await crowdsale.buyToken(usdc.address, value, user2, {
          from: user1,
        });
        const finalClaimableAmount = await crowdsale.getClaimableAmount(user2);
        const soldAmount = await crowdsale.getSoldAmount();

        expectEvent(receipt, 'TokenBought', {
          referral: user2,
        });
        assert(
          finalClaimableAmount
            .sub(initialClaimableAmount)
            .eq(expectedReferralAmount)
        );
        assert(new BN(soldAmount, 10).eq(expectedTokenAmount));
      });

      it('should not allow referral to be buyer', async () => {
        await expectRevert(
          crowdsale.buyToken(
            usdc.address,
            web3.utils.toWei('2500', 'ether'),
            user1,
            {
              from: user1,
            }
          ),
          'DolzCrowdsale: invalid referral address'
        );
      });
    });

    describe('Finalization', () => {
      it('should not finalize if sale not ended', async () => {
        await expectRevert(
          crowdsale.burnRemainingTokens({ from: user1 }),
          'DolzCrowdsale: sale not ended yet'
        );
      });
    });
  });

  describe('After sale', () => {
    beforeEach(async () => {
      await crowdsale.__increaseTimeFrom(time.duration.days(40));
    });

    describe('Sale', () => {
      it('should not sell Dolz token after end', async () => {
        await expectRevert(
          crowdsale.buyToken(usdc.address, '100', ZERO_ADDRESS, {
            from: user1,
          }),
          'DolzCrowdsale: sale ended'
        );
      });
    });

    describe('Finalization', () => {
      it('should burn remaining tokens on finalize', async () => {
        const initialBalance = await token.balanceOf(crowdsale.address);
        const receipt = await crowdsale.burnRemainingTokens({ from: user1 });
        const finalBalance = await token.balanceOf(crowdsale.address);

        expectEvent(receipt, 'RemainingTokensBurnt', {
          remainingBalance: initialBalance,
        });
        assert(finalBalance.eq(new BN(0, 10)));
      });
    });
  });
});
