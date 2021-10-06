// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ITotemToken.sol";

struct SaleSettings {
    address token;
    address wallet;
    uint256 saleStart;
    uint256 saleEnd;
    uint256 withdrawalStart;
    uint256 withdrawPeriodDuration;
    uint256 withdrawPeriodNumber;
    uint256 minBuyValue;
    uint256 maxTokenAmountPerAddress;
    uint256 exchangeRate;
    uint256 referralRewardPercentage;
}

contract TotemCrowdsale is Ownable {
    using SafeERC20 for IERC20;

    address private immutable token;
    address private wallet;
    uint256 private saleStart;
    uint256 private saleEnd;
    uint256 private withdrawalStart;
    uint256 private withdrawPeriodDuration;
    uint256 private withdrawPeriodNumber;
    uint256 private minBuyValue;
    uint256 private maxTokenAmountPerAddress;
    uint256 private exchangeRate;
    uint256 private referralRewardPercentage;

    uint256 private soldAmount;

    mapping(address => bool) private authorizedPaymentCurrencies;
    mapping(address => bool) private referrals;
    mapping(address => uint256) private userToClaimableAmount;
    mapping(address => uint256) private userToWithdrewAmount;

    event WalletUpdated(address newWallet, address indexed updater);
    event SaleStartUpdated(uint256 newSaleStart, address indexed updater);
    event SaleEndUpdated(uint256 newSaleEnd, address indexed updater);
    event WithdrawalStartUpdated(uint256 newWithdrawalStart, address indexed updater);
    event WithdrawPeriodDurationUpdated(uint256 newWithdrawPeriodDuration, address indexed updater);
    event WithdrawPeriodNumberUpdated(uint256 newWithdrawPeriodNumber, address indexed updater);
    event MinBuyValueUpdated(uint256 newMinBuyValue, address indexed updater);
    event MaxTokenAmountPerAddressUpdated(
        uint256 newMaxTokenAmountPerAddress,
        address indexed updater
    );
    event ExchangeRateUpdated(uint256 newExchangeRate, address indexed updater);
    event ReferralRewardPercentageUpdated(
        uint256 newReferralRewardPercentage,
        address indexed updater
    );

    event PaymentCurrenciesAuthorized(address[] tokens, address indexed updater);

    event ReferralRegistered(address newReferral);
    event TokenBought(
        address indexed account,
        address indexed stableCoin,
        uint256 value,
        address indexed referral
    );
    event TokenWithdrew(address indexed account, uint256 amount);
    event RemainingTokensBurnt(uint256 remainingBalance);

    modifier onlyBeforeSaleStart() {
        if (saleStart > 0) {
            require(block.timestamp < saleStart, "TotemCrowdsale: sale already started");
        }
        _;
    }

    constructor(address _token) {
        token = _token;
    }

    function getSaleSettings() external view returns (SaleSettings memory) {
        return
            SaleSettings(
                token,
                wallet,
                saleStart,
                saleEnd,
                withdrawalStart,
                withdrawPeriodDuration,
                withdrawPeriodNumber,
                minBuyValue,
                maxTokenAmountPerAddress,
                exchangeRate,
                referralRewardPercentage
            );
    }

    function getSoldAmount() external view returns (uint256) {
        return soldAmount;
    }

    function getClaimableAmount(address account) external view returns (uint256) {
        return userToClaimableAmount[account];
    }

    function getWithdrewAmount(address account) external view returns (uint256) {
        return userToWithdrewAmount[account];
    }

    function isAuthorizedPaymentCurrency(address paymentCurrency) external view returns (bool) {
        return authorizedPaymentCurrencies[paymentCurrency];
    }

    function isReferral(address account) external view returns (bool) {
        return referrals[account];
    }

    function setWallet(address newWallet) external onlyOwner {
        wallet = newWallet;
        emit WalletUpdated(newWallet, msg.sender);
    }

    function setSaleStart(uint256 newSaleStart) external onlyBeforeSaleStart onlyOwner {
        saleStart = newSaleStart;
        emit SaleStartUpdated(newSaleStart, msg.sender);
    }

    function setSaleEnd(uint256 newSaleEnd) external onlyBeforeSaleStart onlyOwner {
        saleEnd = newSaleEnd;
        emit SaleEndUpdated(newSaleEnd, msg.sender);
    }

    function setWithdrawalStart(uint256 newWithdrawalStart) external onlyBeforeSaleStart onlyOwner {
        withdrawalStart = newWithdrawalStart;
        emit WithdrawalStartUpdated(newWithdrawalStart, msg.sender);
    }

    function setWithdrawPeriodDuration(uint256 newWithdrawPeriodDuration)
        external
        onlyBeforeSaleStart
        onlyOwner
    {
        withdrawPeriodDuration = newWithdrawPeriodDuration;
        emit WithdrawPeriodDurationUpdated(newWithdrawPeriodDuration, msg.sender);
    }

    function setWithdrawPeriodNumber(uint256 newWithdrawPeriodNumber)
        external
        onlyBeforeSaleStart
        onlyOwner
    {
        withdrawPeriodNumber = newWithdrawPeriodNumber;
        emit WithdrawPeriodNumberUpdated(newWithdrawPeriodNumber, msg.sender);
    }

    function setMinBuyValue(uint256 newMinBuyValue) external onlyBeforeSaleStart onlyOwner {
        minBuyValue = newMinBuyValue;
        emit MinBuyValueUpdated(newMinBuyValue, msg.sender);
    }

    function setMaxTokenAmountPerAddress(uint256 newMaxTokenAmountPerAddress)
        external
        onlyBeforeSaleStart
        onlyOwner
    {
        maxTokenAmountPerAddress = newMaxTokenAmountPerAddress;
        emit MaxTokenAmountPerAddressUpdated(newMaxTokenAmountPerAddress, msg.sender);
    }

    function setExchangeRate(uint256 newExchangeRate) external onlyBeforeSaleStart onlyOwner {
        exchangeRate = newExchangeRate;
        emit ExchangeRateUpdated(newExchangeRate, msg.sender);
    }

    function setReferralRewardPercentage(uint256 newReferralRewardPercentage)
        external
        onlyBeforeSaleStart
        onlyOwner
    {
        referralRewardPercentage = newReferralRewardPercentage;
        emit ReferralRewardPercentageUpdated(newReferralRewardPercentage, msg.sender);
    }

    function authorizePaymentCurrencies(address[] memory tokens)
        external
        onlyBeforeSaleStart
        onlyOwner
    {
        for (uint256 i = 0; i < tokens.length; i += 1) {
            authorizedPaymentCurrencies[tokens[i]] = true;
        }
        emit PaymentCurrenciesAuthorized(tokens, msg.sender);
    }

    function registerAsReferral() external {
        referrals[msg.sender] = true;
        emit ReferralRegistered(msg.sender);
    }

    function buyToken(
        address stableCoin,
        uint256 value,
        address referral
    ) external {
        require(authorizedPaymentCurrencies[stableCoin], "TotemCrowdsale: unauthorized token");
        require(block.timestamp >= saleStart, "TotemCrowdsale: sale not started yet");
        require(block.timestamp <= saleEnd, "TotemCrowdsale: sale ended");
        require(value >= minBuyValue, "TotemCrowdsale: under minimum buy value");

        uint256 tokensAvailable = IERC20(token).balanceOf(address(this));
        uint256 claimableAmount = value * exchangeRate;
        require(
            userToClaimableAmount[msg.sender] + claimableAmount <= maxTokenAmountPerAddress,
            "TotemCrowdsale: above maximum token amount per address"
        );
        require(
            soldAmount + claimableAmount <= tokensAvailable,
            "TotemCrowdsale: not enough tokens available"
        );
        userToClaimableAmount[msg.sender] += claimableAmount;
        soldAmount += claimableAmount;

        if (referral != address(0)) {
            require(
                referrals[referral] && referral != msg.sender,
                "TotemCrowdsale: invalid referral address"
            );

            uint256 referralReward = (claimableAmount * referralRewardPercentage) / 100;
            require(
                tokensAvailable >= soldAmount + referralReward,
                "TotemCrowdsale: not enough tokens available"
            );
            userToClaimableAmount[referral] += referralReward;
            soldAmount += referralReward;
        }

        emit TokenBought(msg.sender, stableCoin, value, referral);

        IERC20(stableCoin).safeTransferFrom(msg.sender, wallet, value);
    }

    function withdrawToken() external {
        uint256 periodsElapsed = (block.timestamp - withdrawalStart) / withdrawPeriodDuration + 1; // reverts if before withdrawalStart

        uint256 amountToSend;
        if (periodsElapsed >= withdrawPeriodNumber) {
            amountToSend = userToClaimableAmount[msg.sender] - userToWithdrewAmount[msg.sender];
            delete userToClaimableAmount[msg.sender];
            delete userToWithdrewAmount[msg.sender];
        } else {
            uint256 withdrawableAmountPerPeriod = userToClaimableAmount[msg.sender] /
                withdrawPeriodNumber;
            amountToSend =
                withdrawableAmountPerPeriod *
                periodsElapsed -
                userToWithdrewAmount[msg.sender];
            userToWithdrewAmount[msg.sender] += amountToSend;
        }

        emit TokenWithdrew(msg.sender, amountToSend);

        require(
            IERC20(token).transfer(msg.sender, amountToSend),
            "TotemCrowdsale: transfer failed"
        ); // we know our implementation returns true if success
    }

    function burnRemainingTokens() external {
        require(block.timestamp > saleEnd, "TotemCrowdsale: sale not ended yet");
        uint256 balance = IERC20(token).balanceOf(address(this));
        emit RemainingTokensBurnt(balance);
        ITotemToken(token).burn(balance);
    }
}
