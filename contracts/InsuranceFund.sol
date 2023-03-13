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

    //
    // MODIFIER
    //

    receive() external payable {}

    function _requireOnlyClearingHouse() internal view {
        // only AccountBalance
        require(_msgSender() == _clearingHouse, "RF_OCH");
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
        }
        require(insuranceFundSettlementTokenValueX10_S >= 0, "IF_V0");
        return insuranceFundSettlementTokenValueX10_S;
    }

    function _getInsuranceFundCapacityFull(address baseToken) internal view returns (int256) {
        address vault = _vault;
        int256 insuranceFundSettlementTokenValueX10_S = IVault(vault).getSettlementTokenValue(address(this), baseToken);
        insuranceFundSettlementTokenValueX10_S = insuranceFundSettlementTokenValueX10_S.sub(
            _getSharePlatfromFeeTotal(baseToken).toInt256()
        );
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

    function modifyPlatfromFee(address baseToken, int256 amount) external override {
        _requireOnlyClearingHouse();
        _modifyPlatfromFee(baseToken, amount);
    }

    function addContributionFund(address baseToken, address contributor, uint256 amountX10_18) external override {
        _requireOnlyClearingHouse();
        _contributeFund(baseToken, contributor, amountX10_18);
    }

    function contributeEther(address baseToken) external payable {
        address vault = _vault;
        // IF_STNWE: settlementToken != WETH
        require(IVault(vault).getSettlementToken() == IVault(vault).getWETH9(), "IF_STNWE");
        uint256 amount = msg.value;
        if (amount > 0) {
            IVault(vault).depositEther{ value: amount }(baseToken);
        }
        // credit fund for contributor
        _contributeFund(baseToken, _msgSender(), amount.parseSettlementToken(IVault(vault).decimals()));
    }

    function contribute(address baseToken, address token, uint256 amount) external payable {
        address vault = _vault;
        // IF_STNWE: settlementToken != WETH
        require(IVault(vault).getSettlementToken() != token, "IF_STNWE");
        if (amount > 0) {
            IVault(vault).requestDepositFor(_msgSender(), token, amount, baseToken);
        }
        // credit fund for contributor
        _contributeFund(baseToken, _msgSender(), amount.parseSettlementToken(IVault(vault).decimals()));
    }

    //

    function _isIsolated(address baseToken) internal view returns (bool) {
        return (IMarketRegistry(_marketRegistry).isIsolated(baseToken));
    }

    function _contributeFundTotalOfUsers(address baseToken) internal view returns (uint256) {
        return
            _contributionFundDataMap[baseToken].total.sub(
                _contributionFundDataMap[baseToken].contributors[address(this)]
            );
    }

    function _contributeFundTotalOfUser(address baseToken, address contributor) internal view returns (uint256) {
        return _contributionFundDataMap[baseToken].contributors[contributor];
    }

    function _settlePlatfromFee(address baseToken) internal {
        if (_contributeFundTotalOfUsers(baseToken) > 0) {
            uint256 settleAmount = _platformFundDataMap[baseToken].total.sub(_platformFundDataMap[baseToken].lastTotal);
            _platformFundDataMap[baseToken].lastShared = _platformFundDataMap[baseToken].lastShared.add(
                settleAmount.mul(1e18).div(_contributeFundTotalOfUsers(baseToken))
            );
            _platformFundDataMap[baseToken].lastTotal = _platformFundDataMap[baseToken].total;
        }
    }

    function _getSharePlatfromFeeTotal(address baseToken) internal view returns (uint256) {
        return _platformFundDataMap[baseToken].total;
    }

    function _getSharePlatfromFeeTotalOfUser(address baseToken, address contributor) internal view returns (uint256) {
        uint256 amountContributor = _contributeFundTotalOfUser(baseToken, contributor);
        uint256 lastSharedContributor = _platformFundDataMap[baseToken].lastSharedMap[contributor];
        uint256 lastSharedTotal = _platformFundDataMap[baseToken].lastShared;
        return amountContributor.mul(lastSharedTotal.sub(lastSharedContributor)).div(1e18);
    }

    function _modifyPlatfromFee(address baseToken, int256 amount) internal {
        if (amount > 0) {
            _platformFundDataMap[baseToken].total = _platformFundDataMap[baseToken].total.add(amount.abs());
        } else {
            _platformFundDataMap[baseToken].lastTotal = _platformFundDataMap[baseToken].lastTotal.sub(amount.abs());
            _platformFundDataMap[baseToken].total = _platformFundDataMap[baseToken].total.sub(amount.abs());
        }
    }

    function _contributeFund(address baseToken, address contributor, uint256 settlementTokenAmount) internal {
        _settlePlatfromFee(baseToken);
        if (contributor != address(0) && contributor != address(this)) {
            // repay fee for contributor TODO
            uint256 contributorSharedFeeX10_S = _getSharePlatfromFeeTotalOfUser(baseToken, contributor);
            if (contributorSharedFeeX10_S > 0) {
                uint256 contributorSharedFee = contributorSharedFeeX10_S.formatSettlementToken(
                    IVault(_vault).decimals()
                );
                address settlementToken = IVault(_vault).getSettlementToken();
                if (settlementToken == IVault(_vault).getWETH9()) {
                    IVault(_vault).withdrawEther(contributorSharedFee, baseToken);
                    TransferHelper.safeTransferETH(contributor, contributorSharedFee);
                } else {
                    IVault(_vault).withdraw(settlementToken, contributorSharedFee, baseToken);
                    SafeERC20Upgradeable.safeTransfer(
                        IERC20Upgradeable(settlementToken),
                        contributor,
                        contributorSharedFee
                    );
                }
                _modifyPlatfromFee(baseToken, contributorSharedFeeX10_S.toInt256().neg256());
            }
        }
        _platformFundDataMap[baseToken].lastSharedMap[contributor] = _platformFundDataMap[baseToken].lastShared;
        if (settlementTokenAmount > 0) {
            uint256 fundCapacity = _getInsuranceFundCapacityFull(baseToken).abs();
            uint256 scaleAmount;
            if (fundCapacity == 0) {
                scaleAmount = settlementTokenAmount;
            } else {
                scaleAmount = settlementTokenAmount.mul(_contributionFundDataMap[baseToken].total).div(fundCapacity);
            }
            _contributionFundDataMap[baseToken].total = _contributionFundDataMap[baseToken].total.add(scaleAmount);
            _contributionFundDataMap[baseToken].contributors[contributor] = _contributionFundDataMap[baseToken]
                .contributors[contributor]
                .add(scaleAmount);
            // add repeg fund
            _addRepegFund(settlementTokenAmount, baseToken);
        }
    }
}
