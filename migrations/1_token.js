const DolzToken = artifacts.require('DolzToken');

module.exports = (deployer, network, accounts) => {
  // if (network === 'testnet') return;

  const initialSupply = web3.utils.toWei('1000000000', 'ether'); // 1 billion tokens

  deployer.deploy(DolzToken, 'Dolz', 'DOLZ', initialSupply, {
    from: accounts[0],
  });
};
