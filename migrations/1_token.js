const TotemToken = artifacts.require('TotemToken');

module.exports = (deployer, network, accounts) => {
  if (network === 'test') return;

  const initialSupply = web3.utils.toWei('1000000', 'ether'); // 1 millions tokens

  deployer.deploy(TotemToken, 'Totem', 'TOT', initialSupply, {
    from: accounts[0],
  });
};
