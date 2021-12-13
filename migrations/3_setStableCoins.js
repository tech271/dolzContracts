

const DolzCrowdsale = artifacts.require('DolzCrowdsale');

module.exports = async (deployer, network, accounts) => {

    const stableCoins = [];

    let presale = await DolzCrowdsale.deployed();

    if (network == 'testnet') {
        stableCoins.push('0x64544969ed7EBf5f083679233325356EbE738930'); //usdc
        stableCoins.push('0x337610d27c682E347C9cD60BD4b3b107C9d34dDd'); //usdt
        stableCoins.push('0xEC5dCb5Dbf4B114C9d0F65BcCAb49EC54F6A0867'); //dai



        // await presale.authorizePaymentCurrencies(['0x64544969ed7EBf5f083679233325356EbE738930']);
        // await presale.authorizePaymentCurrencies(['0x337610d27c682E347C9cD60BD4b3b107C9d34dDd']);
        // await presale.authorizePaymentCurrencies(['0xEC5dCb5Dbf4B114C9d0F65BcCAb49EC54F6A0867']);
    }
    else // main net
    {
        // stableCoins.push('0x64544969ed7EBf5f083679233325356EbE738930'); //usdc
        // stableCoins.push('0x337610d27c682E347C9cD60BD4b3b107C9d34dDd'); //usdt
    }

    await presale.authorizePaymentCurrencies(stableCoins);



}