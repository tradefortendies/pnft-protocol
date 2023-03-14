// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;

import { AddressUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import { SignedSafeMathUpgradeable } from "@openzeppelin/contracts-upgradeable/math/SignedSafeMathUpgradeable.sol";
import { SafeMathUpgradeable } from "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { SafeERC20Upgradeable, IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import { PerpMath } from "./lib/PerpMath.sol";
import { PerpSafeCast } from "./lib/PerpSafeCast.sol";
import { InsuranceFundStorageV1 } from "./storage/InsuranceFundStorage.sol";
import { PerpSafeCast } from "./lib/PerpSafeCast.sol";
import { InsuranceFundStorageV4 } from "./storage/InsuranceFundStorage.sol";
import { OwnerPausable } from "./base/OwnerPausable.sol";
import { IInsuranceFund } from "./interface/IInsuranceFund.sol";
import { IMarketRegistry } from "./interface/IMarketRegistry.sol";
import { IVault } from "./interface/IVault.sol";
import { TransferHelper } from "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

// never inherit any new stateful contract. never change the orders of parent stateful contracts
contract InsuranceFund is IInsuranceFund, ReentrancyGuardUpgradeable, OwnerPausable, InsuranceFundStorageV4 {
    using AddressUpgradeable for address;
    using SignedSafeMathUpgradeable for int256;
    using SafeMathUpgradeable for uint256;
    using PerpMath for int256;
    using PerpMath for uint256;
    using PerpSafeCast for int256;
    using PerpSafeCast for uint256;

    uint256 internal constant _PLATFORM_FUND_SHARED_PER_AMOUNT = 1e18;

    //
    // MODIFIER
    //

    receive() external payable {}

    function _requireOnlyClearingHouse() internal view {
        // only AccountBalance
        require(_msgSender() == _clearingHouse, "RF_OCH");
    }

    modifier onlyIsolatedMarket(address baseToken) {
        // transaction expires
        require(_isIsolated(baseToken), "IF_NIM");
        _;
    }

    function initialize(address tokenArg) external initializer {
        // token address is not contract
        require(tokenArg.isContract(), "IF_TNC");

        __ReentrancyGuard_init();
        __OwnerPausable_init();

        _token = tokenArg;
    }

    function setVault(address vaultArg) external onlyOwner {
        // vault is not a contract
        require(vaultArg.isContract(), "IF_VNC");
        _vault = vaultArg;
        emit VaultChanged(vaultArg);
    }

    function setClearingHouse(address clearingHouseArg) external onlyOwner {
        _clearingHouse = clearingHouseArg;
        emit ClearingHouseChanged(clearingHouseArg);
    }

    //
    // EXTERNAL VIEW
    //

    /// @inheritdoc IInsuranceFund
    function getToken() external view override returns (address) {
        return _token;
    }

    /// @inheritdoc IInsuranceFund
    function getVault() external view override returns (address) {
        return _vault;
    }

    function getClearingHouse() external view override returns (address) {
        return _clearingHouse;
    }

    function setMarketRegistry(address marketRegistryArg) external onlyOwner {
        require(marketRegistryArg.isContract(), "IF_MRNC");
        _marketRegistry = marketRegistryArg;
    }

    //
    // PUBLIC VIEW
    //

    /// @inheritdoc IInsuranceFund
    function getInsuranceFundCapacity(address baseToken) public view override returns (int256) {
        int256 insuranceFundSettlementTokenValueX10_S = _getInsuranceFundCapacityFull(baseToken);
        if (insuranceFundSettlementTokenValueX10_S > 1e14) {
            insuranceFundSettlementTokenValueX10_S = insuranceFundSettlementTokenValueX10_S.sub(1e14);
        } else {
            insuranceFundSettlementTokenValueX10_S = 0;
        }
        return insuranceFundSettlementTokenValueX10_S;
    }

    /// @inheritdoc IInsuranceFund
    function getInsuranceFundCapacityFull(address baseToken) public view override returns (int256) {
        return _getInsuranceFundCapacityFull(baseToken);
    }

    function _getInsuranceFundCapacityFull(address baseToken) internal view returns (int256) {
        address vault = _vault;
        int256 insuranceFundSettlementTokenValueX10_S = IVault(vault).getSettlementTokenValue(address(this), baseToken);
        insuranceFundSettlementTokenValueX10_S = insuranceFundSettlementTokenValueX10_S.sub(
            _getTotalSharedPlatformFee(baseToken).toInt256()
        );
        // IF_V0 : check zero value
        require(insuranceFundSettlementTokenValueX10_S >= 0, "IF_V0");
        return insuranceFundSettlementTokenValueX10_S;
    }

    //
    function getRepegAccumulatedFund(address baseToken) external view override returns (int256) {
        if (_isIsolated(baseToken)) {
            return _accumulatedRepegFundMap[baseToken];
            // revert("TODO");
        } else {
            return _accumulatedRepegFund;
        }
    }

    function getRepegDistributedFund(address baseToken) external view override returns (int256) {
        if (_isIsolated(baseToken)) {
            return _distributedRepegFundMap[baseToken];
            // revert("TODO");
        } else {
            return _distributedRepegFund;
        }
    }

    // internal function

    function _addRepegFund(uint256 fund, address baseToken) internal {
        if (_isIsolated(baseToken)) {
            _accumulatedRepegFundMap[baseToken] = _accumulatedRepegFundMap[baseToken].add(fund.toInt256());
            // revert("TODO");
        } else {
            _accumulatedRepegFund = _accumulatedRepegFund.add(fund.toInt256());
        }
    }

    function _distributeRepegFund(int256 fund, address baseToken) internal {
        if (_isIsolated(baseToken)) {
            _distributedRepegFundMap[baseToken] = _distributedRepegFundMap[baseToken].add(fund);
            // RF_LF: limit fund
            require(_distributedRepegFundMap[baseToken] <= _accumulatedRepegFundMap[baseToken], "RF_LF");
            // revert("TODO");
        } else {
            _distributedRepegFund = _distributedRepegFund.add(fund);
            // RF_LF: limit fund
            require(_distributedRepegFund <= _accumulatedRepegFund, "RF_LF");
        }
    }

    // external function

    function addRepegFund(uint256 fund, address baseToken) external override {
        _requireOnlyClearingHouse();
        _addRepegFund(fund, baseToken);
    }

    function repegFund(int256 fund, address baseToken) external override {
        _requireOnlyClearingHouse();
        _distributeRepegFund(fund, baseToken);
    }

    function modifyPlatformFee(address baseToken, int256 amount) external override {
        // IF_NIT: not isolated token
        require(_isIsolated(baseToken), "IF_NIT");
        _requireOnlyClearingHouse();
        _modifyPlatformFee(baseToken, amount);
    }

    function addContributionFund(
        address baseToken,
        address contributor,
        uint256 amountX10_18
    ) external override onlyIsolatedMarket(baseToken) {
        _requireOnlyClearingHouse();
        _contributeFund(baseToken, contributor, amountX10_18);
    }

    function contributeEther(address baseToken) external payable override onlyIsolatedMarket(baseToken) {
        address vault = _vault;
        // IF_STNWE: settlementToken != WETH
        require(IVault(vault).getSettlementToken() == IVault(vault).getWETH9(), "IF_STNWE");
        uint256 amount = msg.value;
        require(amount > 0, "IF_ZV");
        // credit fund for contributor
        _contributeFund(baseToken, _msgSender(), amount.parseSettlementToken(IVault(vault).decimals()));
        IVault(vault).depositEther{ value: amount }(baseToken);
    }

    function contribute(address baseToken, address token, uint256 amount) external override onlyIsolatedMarket(baseToken) {
        address vault = _vault;
        // IF_STNWE: settlementToken != WETH
        require(IVault(vault).getSettlementToken() == token, "IF_STNWE");
        require(amount > 0, "IF_ZV");
        // credit fund for contributor
        _contributeFund(baseToken, _msgSender(), amount.parseSettlementToken(IVault(vault).decimals()));
        IVault(vault).requestDepositFromTo(_msgSender(), address(this), token, amount, baseToken);
    }

    function withdrawPlatformFee(address baseToken) external override onlyIsolatedMarket(baseToken) {
        _releasePlatfromFee(baseToken, _msgSender());
    }

    function getAvailableFund(
        address baseToken,
        address contributor
    ) external view onlyIsolatedMarket(baseToken) returns (uint256 insuranceBalance, uint256 sharedFee, uint256 pendingFee) {
        insuranceBalance = _getCurrentInsuranceFundBalance(baseToken, contributor);
        (sharedFee, pendingFee) = _getSharedPlatfromFee(baseToken, contributor);
    }

    function getContributedInfo(
        address baseToken,
        address user
    )
        external
        view
        onlyIsolatedMarket(baseToken)
        returns (uint256 balance, uint256 total, uint256 userAllTotal, uint256 fundCapacity)
    {
        balance = _contributionFundDataMap[baseToken].contributors[user];
        total = _contributionFundDataMap[baseToken].total;
        userAllTotal = _contributedFundAllUsers(baseToken);
        fundCapacity = _getInsuranceFundCapacityFull(baseToken).abs();
    }

    function getSharedPlatformFeeInfo(
        address baseToken,
        address user
    )
        external
        view
        onlyIsolatedMarket(baseToken)
        returns (uint256 balance, uint256 userShared, uint256 lastShared, uint256 pendingFee)
    {
        balance = _contributionFundDataMap[baseToken].contributors[user];
        userShared = _platformFundDataMap[baseToken].lastSharedMap[user];
        lastShared = _platformFundDataMap[baseToken].lastShared;
        if (user == IMarketRegistry(_marketRegistry).getCreator(baseToken)) {
            pendingFee = _platformFundDataMap[baseToken].creatorPendingFee;
        }
    }

    //

    function _isIsolated(address baseToken) internal view returns (bool) {
        return (IMarketRegistry(_marketRegistry).isIsolated(baseToken));
    }

    function _isContributed(address baseToken) internal view returns (bool) {
        return _contributedFundAllUsers(baseToken) > 0;
    }

    function _contributedFundAllUsers(address baseToken) internal view returns (uint256) {
        return
            _contributionFundDataMap[baseToken].total.sub(
                _contributionFundDataMap[baseToken].contributors[address(this)]
            );
    }

    function _getTotalSharedPlatformFee(address baseToken) internal view returns (uint256) {
        return _platformFundDataMap[baseToken].total.add(_platformFundDataMap[baseToken].creatorPendingFee);
    }

    function _getSharedPlatfromFee(
        address baseToken,
        address contributor
    ) internal view returns (uint256 sharedFee, uint256 pendingFee) {
        if (contributor != address(0) && contributor != address(this)) {
            uint256 amountContributor = _contributionFundDataMap[baseToken].contributors[contributor];
            uint256 lastSharedContributor = _platformFundDataMap[baseToken].lastSharedMap[contributor];
            uint256 lastShared = _platformFundDataMap[baseToken].lastShared;
            sharedFee = amountContributor.mul(lastShared.sub(lastSharedContributor)).div(
                _PLATFORM_FUND_SHARED_PER_AMOUNT
            );
            if (contributor == IMarketRegistry(_marketRegistry).getCreator(baseToken)) {
                pendingFee = _platformFundDataMap[baseToken].creatorPendingFee;
            }
        }
    }

    function _getCurrentInsuranceFundBalance(
        address baseToken,
        address contributor
    ) internal view returns (uint256 sharedFund) {
        uint256 fundCapacity = _getInsuranceFundCapacityFull(baseToken).abs();
        if (fundCapacity > 0) {
            sharedFund = fundCapacity.mul(_contributionFundDataMap[baseToken].contributors[contributor]).div(
                _contributionFundDataMap[baseToken].total
            );
        }
        return sharedFund;
    }

    function _getNewSharedPlatformFee(address baseToken) internal view returns (uint256 newLastShared) {
        uint256 settleAmount = _platformFundDataMap[baseToken].total.sub(_platformFundDataMap[baseToken].lastTotal);
        newLastShared = _platformFundDataMap[baseToken].lastShared.add(
            settleAmount.mul(_PLATFORM_FUND_SHARED_PER_AMOUNT).div(_contributedFundAllUsers(baseToken))
        );
        return newLastShared;
    }

    function _settlePlatformFee(address baseToken) internal {
        if (_isContributed(baseToken)) {
            _platformFundDataMap[baseToken].lastShared = _getNewSharedPlatformFee(baseToken);
            _platformFundDataMap[baseToken].lastTotal = _platformFundDataMap[baseToken].total;
        }
    }

    function _modifyPlatformFee(address baseToken, int256 amountX10_18) internal {
        if (_isContributed(baseToken)) {
            if (amountX10_18 > 0) {
                _platformFundDataMap[baseToken].total = _platformFundDataMap[baseToken].total.add(amountX10_18.abs());
            } else {
                _platformFundDataMap[baseToken].lastTotal = _platformFundDataMap[baseToken].lastTotal.sub(
                    amountX10_18.abs()
                );
                _platformFundDataMap[baseToken].total = _platformFundDataMap[baseToken].total.sub(amountX10_18.abs());
            }
        } else {
            _modifyCreatorPendingFee(baseToken, amountX10_18);
        }
    }

    function _modifyCreatorPendingFee(address baseToken, int256 amountX10_18) internal {
        if (amountX10_18 != 0) {
            if (amountX10_18 > 0) {
                _platformFundDataMap[baseToken].creatorPendingFee = _platformFundDataMap[baseToken]
                    .creatorPendingFee
                    .add(amountX10_18.abs());
            } else {
                _platformFundDataMap[baseToken].creatorPendingFee = _platformFundDataMap[baseToken]
                    .creatorPendingFee
                    .sub(amountX10_18.abs());
            }
        }
    }

    function _releasePlatfromFee(address baseToken, address contributor) internal {
        _settlePlatformFee(baseToken);
        if (contributor != address(0) && contributor != address(this)) {
            (uint256 sharedFeeX10_18, uint256 pendingFeeX10_18) = _getSharedPlatfromFee(baseToken, contributor);
            uint256 releasedFeeX10_18 = sharedFeeX10_18.add(pendingFeeX10_18);
            if (releasedFeeX10_18 > 0) {
                uint256 sharedFeeX10_D = releasedFeeX10_18.formatSettlementToken(IVault(_vault).decimals());
                address settlementToken = IVault(_vault).getSettlementToken();
                if (settlementToken == IVault(_vault).getWETH9()) {
                    IVault(_vault).withdrawEther(sharedFeeX10_D, baseToken);
                    TransferHelper.safeTransferETH(contributor, sharedFeeX10_D);
                } else {
                    IVault(_vault).withdraw(settlementToken, sharedFeeX10_D, baseToken);
                    SafeERC20Upgradeable.safeTransfer(IERC20Upgradeable(settlementToken), contributor, sharedFeeX10_D);
                }
                _modifyPlatformFee(baseToken, releasedFeeX10_18.toInt256().neg256());
                _modifyCreatorPendingFee(baseToken, pendingFeeX10_18.toInt256().neg256());
                //
                emit PlatformFeeReleased(baseToken, contributor, sharedFeeX10_18, pendingFeeX10_18);
            }
        }
        // update last shared fee
        _platformFundDataMap[baseToken].lastSharedMap[contributor] = _platformFundDataMap[baseToken].lastShared;
    }

    function _contributeFund(address baseToken, address contributor, uint256 amountX10_18) internal {
        _releasePlatfromFee(baseToken, contributor);
        // contribute fund
        if (amountX10_18 > 0) {
            uint256 fundCapacity = _getInsuranceFundCapacityFull(baseToken).abs();
            uint256 contributedAmount;
            if (fundCapacity == 0) {
                contributedAmount = amountX10_18;
            } else {
                contributedAmount = amountX10_18.mul(_contributionFundDataMap[baseToken].total).div(fundCapacity);
            }
            _contributionFundDataMap[baseToken].total = _contributionFundDataMap[baseToken].total.add(
                contributedAmount
            );
            _contributionFundDataMap[baseToken].contributors[contributor] = _contributionFundDataMap[baseToken]
                .contributors[contributor]
                .add(contributedAmount);
            //

            emit InsuranceFundContributed(baseToken, contributor, amountX10_18, contributedAmount);
            // add repeg fund
            _addRepegFund(amountX10_18, baseToken);
        }
    }
}
