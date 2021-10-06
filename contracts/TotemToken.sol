// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "./ITotemToken.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

struct BridgeUpdate {
    address newBridge;
    uint256 endGracePeriod;
    bool hasToBeExecuted;
}

contract TotemToken is ITotemToken, ERC20, Ownable {
    address private bridge;
    BridgeUpdate private bridgeUpdate;

    modifier onlyBridge() {
        require(msg.sender == bridge, "TotemToken: access denied");
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
    }

    function getBridge() external view returns (address) {
        return bridge;
    }

    function getBridgeUpdate() external view returns (BridgeUpdate memory) {
        return bridgeUpdate;
    }

    function launchBridgeUpdate(address newBridge) external onlyOwner {
        require(!bridgeUpdate.hasToBeExecuted, "TotemToken: current update has to be executed");
        require(isContract(newBridge), "TotemToken: address provided is not a contract");

        uint256 endGracePeriod = block.timestamp + 604800; // 604800 = 7 days

        bridgeUpdate = BridgeUpdate(newBridge, endGracePeriod, true);

        emit BridgeUpdateLaunched(newBridge, endGracePeriod);
    }

    function executeBridgeUpdate() external onlyOwner {
        require(
            bridgeUpdate.endGracePeriod <= block.timestamp,
            "TotemToken: grace period has not finished"
        );
        require(bridgeUpdate.hasToBeExecuted, "TotemToken: update already executed");

        bridgeUpdate.hasToBeExecuted = false;
        bridge = bridgeUpdate.newBridge;

        emit BridgeUpdateExecuted(bridgeUpdate.newBridge);
    }

    function mintFromBridge(address account, uint256 amount) external override onlyBridge {
        _mint(account, amount);
    }

    function burnFromBridge(address account, uint256 amount) external override onlyBridge {
        _burn(account, amount);
    }

    function burn(uint256 amount) external override {
        _burn(msg.sender, amount);
    }

    function isContract(address target) private view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(target) // retrieve the size of the code at the address
        }
        return size > 0;
    }
}
