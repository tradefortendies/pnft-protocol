// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;

import { AddressUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import { SignedSafeMathUpgradeable } from "@openzeppelin/contracts-upgradeable/math/SignedSafeMathUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { PerpMath } from "./lib/PerpMath.sol";
import { PerpSafeCast } from "./lib/PerpSafeCast.sol";
import { InsuranceFundStorageV1 } from "./storage/InsuranceFundStorage.sol";
import { PerpSafeCast } from "./lib/PerpSafeCast.sol";
import { InsuranceFundStorageV3 } from "./storage/InsuranceFundStorage.sol";
import { OwnerPausable } from "./base/OwnerPausable.sol";
import { IInsuranceFund } from "./interface/IInsuranceFund.sol";
import { IMarketRegistry } from "./interface/IMarketRegistry.sol";
import { IVault } from "./interface/IVault.sol";

// never inherit any new stateful contract. never change the orders of parent stateful contracts
contract InsuranceFund is IInsuranceFund, ReentrancyGuardUpgradeable, OwnerPausable, InsuranceFundStorageV3 {
    using AddressUpgradeable for address;
    using SignedSafeMathUpgradeable for int256;
    using PerpMath for int256;
    using PerpSafeCast for int256;
    using PerpSafeCast for uint256;

    //
    // MODIFIER
    //

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
        address vault = _vault;
        int256 insuranceFundSettlementTokenValueX10_S = IVault(vault).getSettlementTokenValue(address(this), baseToken);
        return insuranceFundSettlementTokenValueX10_S;

        // address vault = _vault;
        // address token = _token;

        // int256 insuranceFundSettlementTokenValueX10_S = IVault(vault).getSettlementTokenValue(address(this), baseToken);
        // int256 insuranceFundWalletBalanceX10_S = IERC20Upgradeable(token).balanceOf(address(this)).toInt256();

        // return insuranceFundSettlementTokenValueX10_S.add(insuranceFundWalletBalanceX10_S);
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

    function _isIsolated(address baseToken) internal view returns (bool) {
        return (IMarketRegistry(_marketRegistry).isIsolated(baseToken));
    }
}
