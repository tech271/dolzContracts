const { time } = require('@openzeppelin/test-helpers');

const DolzToken = artifacts.require('DolzToken');
const DolzCrowdsale = artifacts.require('DolzCrowdsale');
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

  wallet = accounts[0];

  if (network === 'testnet') {
    saleStart = Math.floor(Date.now() / 1000) + 300;                                            //23 nov
    saleEnd = Math.floor(Date.now() / 1000) + (4 * 24 * 3600);                                            //22 dec
    withdrawalStart = saleEnd;                                      //claim start (end of presale)
    withdrawPeriodDuration = time.duration.days(10).toNumber();     //with claim every 10 days
    withdrawPeriodNumber = 10;                                      //10 periods duration claims
    minBuyValue = web3.utils.toWei('1', 'ether');                   //min buy 1 USD
    maxTokenAmountPerAddress = web3.utils.toWei('100000', 'ether'); //max buy 100000 DOLZ
    exchangeRate = '83333333300000000000';                          //50: 1 dolz = 50 USD
    referralRewardPercentage = 5;                                   //ref: 2%

  }
  else // main net
  {
    saleStart = 1637590333;                                         //22 nov
    saleEnd = 1640268733;                                           //22 dec
    withdrawalStart = saleEnd;                                      //claim start (end of presale)
    withdrawPeriodDuration = time.duration.days(10).toNumber();     //with claim every 10 days
    withdrawPeriodNumber = 10;                                      //10 periods duration claims
    minBuyValue = web3.utils.toWei('500', 'ether');                 //min buy in tokens
    maxTokenAmountPerAddress = web3.utils.toWei('20000', 'ether');  //max buy 
    exchangeRate = '83333333300000000000';                                      //50: 1 dolz = 50 USD
    referralRewardPercentage = 5;                                   //ref: 2%

  }

  // get dolztoken
  const token = await DolzToken.deployed();

  // deploy crowdsale
  // constructor: 
  // address _token,
  // address _wallet,
  // uint256 _saleStart,
  // uint256 _saleEnd,
  // uint256 _withdrawalStart,
  // uint256 _withdrawPeriodDuration,
  // uint256 _withdrawPeriodNumber,
  // uint256 _minBuyValue,
  // uint256 _maxTokenAmountPerAddress,
  // uint256 _exchangeRate,
  // uint256 _referralRewardPercentage,
  // address[] _currencies

  const crowdsale = await deployer.deploy(
    DolzCrowdsale,
    token.address,
    accounts[0],
    saleStart,
    saleEnd,
    withdrawalStart,
    withdrawPeriodDuration,
    withdrawPeriodNumber,
    minBuyValue,
    maxTokenAmountPerAddress,
    exchangeRate,
    referralRewardPercentage,
    // stableCoins,
    {
      from: accounts[0]
    }
  );




  // try {
  //   await crowdsale.setWallet(wallet);
  //   console.log('Wallet set');
  //   await crowdsale.setSaleStart(saleStart);
  //   console.log('Sale start set');
  //   await crowdsale.setSaleEnd(saleEnd);
  //   console.log('Sale end set');
  //   await crowdsale.setWithdrawalStart(withdrawalStart);
  //   console.log('Withdrawal start set');
  //   await crowdsale.setWithdrawPeriodDuration(withdrawPeriodDuration);
  //   console.log('Withdrawal period duration set');
  //   await crowdsale.setWithdrawPeriodNumber(withdrawPeriodNumber);
  //   console.log('Withdrawal period number set');
  //   await crowdsale.setMinBuyValue(minBuyValue);
  //   console.log('Minimum buy value set');
  //   await crowdsale.setMaxTokenAmountPerAddress(maxTokenAmountPerAddress);
  //   console.log('Max token amount per address set');
  //   await crowdsale.setExchangeRate(exchangeRate);
  //   console.log('Exchange rate set');
  //   await crowdsale.setReferralRewardPercentage(referralRewardPercentage);
  //   console.log('Referral reward percentage set');
  //   await crowdsale.authorizePaymentCurrencies(stableCoins);
  //   console.log('Payment currencies set');
  // } catch (err) {
  //   console.error(err);
  // }
};

//  presale 1 
//  exchangeRate = 83.3333333  (0.012 USD)
//  83333333300000000000
//
//  1 usd      token
//  0.012 usdd    1 token
//
//

//  presale 2 
//  exchangeRate = 71.4285714286  (0.014 USD)
//  71428571428600000000
//
//
//
//
//

//  presale 3 
//  exchangeRate = 62.5  (0.016 USD)
//  62500000000000000000
//
//
//
//
//







// ganache test only, with create usd tokens
  // if (network === 'ganache' ) {
  //   
  //   saleStart = Math.floor(new Date().getTime() / 1000);
  //   saleStart += time.duration.minutes(1).toNumber();
  //   saleEnd = saleStart + time.duration.weeks(4).toNumber();
// 
  //   withdrawalStart = saleEnd;
  //   withdrawPeriodDuration = time.duration.minutes(10).toNumber();
  //   withdrawPeriodNumber = 10;
  //   minBuyValue = web3.utils.toWei('300', 'ether');
  //   maxTokenAmountPerAddress = web3.utils.toWei('500000', 'ether');
  //   exchangeRate = 50;
  //   referralRewardPercentage = 2;
// 
  //   const initialUsdcSupply = web3.utils.toWei('1000000', 'ether'); // 1 millions tokens
  //   await deployer.deploy(LambdaToken, 'DAI', 'DAI', initialUsdcSupply, {
  //     from: accounts[0],
  //   });
  //   await deployer.deploy(LambdaToken, 'USDC', 'USDC', initialUsdcSupply, {
  //     from: accounts[0],
  //   });
  //   const testUsdc = await LambdaToken.deployed();
// 
  //   stableCoins.push(testUsdc.address);
  // }
  //---------------------- end ganache