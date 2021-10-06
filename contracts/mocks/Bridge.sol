// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../ITotemToken.sol";

contract Bridge {
    ITotemToken immutable totemToken;

    constructor(ITotemToken _totemToken) {
        totemToken = _totemToken;
    }

    function deposit(address account, uint256 amount) external {
        totemToken.mintFromBridge(account, amount);
    }

    function withdraw(address account, uint256 amount) external {
        totemToken.burnFromBridge(account, amount);
    }
}
