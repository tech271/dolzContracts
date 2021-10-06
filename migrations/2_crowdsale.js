const { time } = require('@openzeppelin/test-helpers');

const TotemToken = artifacts.require('TotemToken');
const TotemCrowdsale = artifacts.require('TotemCrowdsale');
const LambdaToken = artifacts.require('LambdaToken');

module.exports = async (deployer, network, accounts) => {
  if (network === 'test') return;

  let wallet;
  let saleStart;
  let saleEnd;
  let withdrawalStart;
  let withdrawPeriodDuration;
  let withdrawPeriodNumber;
  let minBuyValue;
  let maxTokenAmountPerAddress;
  let exchangeRate;
  let referralRewardPercentage;
  const stableCoins = [];

  if (network === 'ganache' || network === 'bsc_test') {
    wallet = accounts[0];

    saleStart = Math.floor(new Date().getTime() / 1000);
    saleStart += time.duration.minutes(1).toNumber();
    saleEnd = saleStart + time.duration.weeks(4).toNumber();

    withdrawalStart = saleEnd;
    withdrawPeriodDuration = time.duration.minutes(10).toNumber();
    withdrawPeriodNumber = 10;
    minBuyValue = web3.utils.toWei('300', 'ether');
    maxTokenAmountPerAddress = web3.utils.toWei('500000', 'ether');
    exchangeRate = 50;
    referralRewardPercentage = 2;

    const initialUsdcSupply = web3.utils.toWei('1000000', 'ether'); // 1 millions tokens
    await deployer.deploy(LambdaToken, 'DAI', 'DAI', initialUsdcSupply, {
      from: accounts[0],
    });
    await deployer.deploy(LambdaToken, 'USDC', 'USDC', initialUsdcSupply, {
      from: accounts[0],
    });
    const testUsdc = await LambdaToken.deployed();

    stableCoins.push(testUsdc.address);
  }

  const token = await TotemToken.deployed();

  const crowdsale = await deployer.deploy(TotemCrowdsale, token.address, {
    from: accounts[0],
  });

  try {
    await crowdsale.setWallet(wallet);
    console.log('Wallet set');
    await crowdsale.setSaleStart(saleStart);
    console.log('Sale start set');
    await crowdsale.setSaleEnd(saleEnd);
    console.log('Sale end set');
    await crowdsale.setWithdrawalStart(withdrawalStart);
    console.log('Withdrawal start set');
    await crowdsale.setWithdrawPeriodDuration(withdrawPeriodDuration);
    console.log('Withdrawal period duration set');
    await crowdsale.setWithdrawPeriodNumber(withdrawPeriodNumber);
    console.log('Withdrawal period number set');
    await crowdsale.setMinBuyValue(minBuyValue);
    console.log('Minimum buy value set');
    await crowdsale.setMaxTokenAmountPerAddress(maxTokenAmountPerAddress);
    console.log('Max token amount per address set');
    await crowdsale.setExchangeRate(exchangeRate);
    console.log('Exchange rate set');
    await crowdsale.setReferralRewardPercentage(referralRewardPercentage);
    console.log('Referral reward percentage set');
    await crowdsale.authorizePaymentCurrencies(stableCoins);
    console.log('Payment currencies set');
  } catch (err) {
    console.error(err);
  }
};
