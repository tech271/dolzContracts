const TotemToken = artifacts.require('TotemToken');
const Bridge = artifacts.require('Bridge');

const {
  BN,
  constants,
  expectRevert,
  expectEvent,
  time,
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;

const skipGracePeriod = () => time.increase(time.duration.days(7));

const setBridgeAddress = async (token, bridge, owner) => {
  await token.launchBridgeUpdate(bridge, { from: owner });
  skipGracePeriod();
  await token.executeBridgeUpdate({ from: owner });
};

contract('TotemToken', (accounts) => {
  const name = 'Test Token';
  const symbol = 'TST';
  const initialSupply = new BN('1000000000000000000000000', 10); // 1 millions tokens
  let token;
  let bridge;
  const [owner, random, user] = accounts;

  beforeEach(async () => {
    token = await TotemToken.new(name, symbol, initialSupply, {
      from: owner,
    });
    bridge = await Bridge.new(token.address, {
      from: owner,
    });
  });

  describe('Initialisation', () => {
    it('should mint at deployment', async () => {
      const res = await token.balanceOf(owner);
      assert.isTrue(res.eq(initialSupply));
    });

    it('should store owner address as owner', async () => {
      const res = await token.owner();
      assert(res === owner);
    });

    it('should leave bridge address to zero', async () => {
      const res = await token.getBridge();
      assert(res === ZERO_ADDRESS);
    });
  });

  describe('ERC20', () => {
    it('should have a name', async () => {
      const res = await token.name();
      assert(res === name);
    });

    it('should have a symbol', async () => {
      const res = await token.symbol();
      assert(res === symbol);
    });

    it('should have 18 decimals', async () => {
      const decimals = new BN(18, 10);
      const res = await token.decimals();
      assert(res.eq(decimals));
    });
  });

  describe('Bridge update', () => {
    it('should initialise update at zero address, 0 and false', async () => {
      const res = await token.getBridgeUpdate();
      assert(res.newBridge === ZERO_ADDRESS);
      assert(res.endGracePeriod === '0');
      assert(res.hasToBeExecuted === false);
    });

    it('should launch bridge update', async () => {
      const receipt = await token.launchBridgeUpdate(bridge.address, {
        from: owner,
      });
      const res = await token.getBridgeUpdate();

      expectEvent(receipt, 'BridgeUpdateLaunched', {
        newBridge: bridge.address,
      });
      assert(res.newBridge === bridge.address);
      assert(res.hasToBeExecuted === true);
    });

    it('should not launch bridge update if not owner', async () => {
      await expectRevert(
        token.launchBridgeUpdate(bridge.address, { from: random }),
        'Ownable: caller is not the owner'
      );
    });

    it('should not launch bridge update if last one not executed', async () => {
      await token.launchBridgeUpdate(bridge.address, { from: owner });
      await expectRevert(
        token.launchBridgeUpdate(bridge.address, { from: owner }),
        'TotemToken: current update has to be executed'
      );
    });

    it('should not launch bridge update if address is not a contract', async () => {
      await expectRevert(
        token.launchBridgeUpdate(random, { from: owner }),
        'TotemToken: address provided is not a contract'
      );
    });

    it('should execute bridge update', async () => {
      await token.launchBridgeUpdate(bridge.address, { from: owner });

      skipGracePeriod();

      const receipt = await token.executeBridgeUpdate({ from: owner });
      const resBridge = await token.getBridge();
      const resUpdate = await token.getBridgeUpdate();

      expectEvent(receipt, 'BridgeUpdateExecuted', {
        newBridge: bridge.address,
      });
      assert(resBridge === bridge.address);
      assert(resUpdate.hasToBeExecuted === false);
    });

    it('should not execute bridge update if not owner', async () => {
      await token.launchBridgeUpdate(bridge.address, { from: owner });
      await expectRevert(
        token.executeBridgeUpdate({ from: random }),
        'Ownable: caller is not the owner'
      );
    });

    it('should launch bridge update if last one executed', async () => {
      await token.launchBridgeUpdate(bridge.address, { from: owner });

      skipGracePeriod();

      await token.executeBridgeUpdate({ from: owner });
      await token.launchBridgeUpdate(bridge.address, { from: owner });
    });

    it('should not launch bridge update if last one executed', async () => {
      await token.launchBridgeUpdate(bridge.address, { from: owner });

      skipGracePeriod();

      await token.executeBridgeUpdate({ from: owner });
      await token.launchBridgeUpdate(bridge.address, { from: owner });
    });

    it('should not execute bridge update before 7 days has passed', async () => {
      await token.launchBridgeUpdate(bridge.address, { from: owner });
      await expectRevert(
        token.executeBridgeUpdate({ from: owner }),
        'TotemToken: grace period has not finished'
      );
    });

    it('should not execute if already executed', async () => {
      await token.launchBridgeUpdate(bridge.address, { from: owner });
      skipGracePeriod();
      await token.executeBridgeUpdate({ from: owner });

      await expectRevert(
        token.executeBridgeUpdate({ from: owner }),
        'TotemToken: update already executed'
      );
    });
  });

  describe('Bridge minting', () => {
    it('should mint if bridge', async () => {
      await setBridgeAddress(token, bridge.address, owner);

      const amount = new BN('1000', 10);
      const initialBalance = await token.balanceOf(user);
      await bridge.deposit(user, amount, { from: owner });
      const finalBalance = await token.balanceOf(user);

      assert(finalBalance.sub(initialBalance).eq(amount));
    });

    it('should not mint if bridge not initialised and zero address used', async () => {
      await expectRevert(
        token.mintFromBridge(user, '1000', {
          from: ZERO_ADDRESS,
        }),
        'error: sender account not recognized'
      );
    });

    it('should not mint if not bridge', async () => {
      await setBridgeAddress(token, bridge.address, owner);
      await expectRevert(
        token.mintFromBridge(user, '1000', {
          from: random,
        }),
        'TotemToken: access denied'
      );
    });
  });

  describe('Bridge burning', () => {
    it('should burn if bridge', async () => {
      await setBridgeAddress(token, bridge.address, owner);

      const amount = new BN('1000', 10);
      const initialBalance = await token.balanceOf(owner);
      await bridge.withdraw(owner, amount, { from: owner });
      const finalBalance = await token.balanceOf(owner);

      assert(initialBalance.sub(finalBalance).eq(amount));
    });

    it('should not burn if bridge not initialised and zero address used', async () => {
      await expectRevert(
        token.burnFromBridge(owner, '1000', {
          from: ZERO_ADDRESS,
        }),
        'error: sender account not recognized'
      );
    });

    it('should not burn if not bridge', async () => {
      await setBridgeAddress(token, bridge.address, owner);
      await expectRevert(
        token.burnFromBridge(owner, '1000', {
          from: random,
        }),
        'TotemToken: access denied'
      );
    });
  });

  describe('User functions', () => {
    it('should burn for user', async () => {
      const amount = new BN('1000', 10);
      const initialBalance = await token.balanceOf(owner);
      await token.burn(amount, { from: owner });
      const finalBalance = await token.balanceOf(owner);
      assert(initialBalance.sub(finalBalance).eq(amount));
    });
  });
});
