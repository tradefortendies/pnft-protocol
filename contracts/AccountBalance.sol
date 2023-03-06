// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma abicoder v2;

import { AddressUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import { SafeMathUpgradeable } from "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import { SignedSafeMathUpgradeable } from "@openzeppelin/contracts-upgradeable/math/SignedSafeMathUpgradeable.sol";
import { FullMath } from "@uniswap/v3-core/contracts/libraries/FullMath.sol";
import { ClearingHouseCallee } from "./base/ClearingHouseCallee.sol";
import { PerpSafeCast } from "./lib/PerpSafeCast.sol";
import { PerpMath } from "./lib/PerpMath.sol";
import { IVault } from "./interface/IVault.sol";
import { IVPool } from "./interface/IVPool.sol";
import { IClearingHouseConfig } from "./interface/IClearingHouseConfig.sol";
import { AccountBalanceStorageV2 } from "./storage/AccountBalanceStorage.sol";
import { BlockContext } from "./base/BlockContext.sol";
import { IAccountBalance } from "./interface/IAccountBalance.sol";
import { IMarketRegistry } from "./interface/IMarketRegistry.sol";
import { DataTypes } from "./types/DataTypes.sol";

// never inherit any new stateful contract. never change the orders of parent stateful contracts
contract AccountBalance is IAccountBalance, BlockContext, ClearingHouseCallee, AccountBalanceStorageV2 {
    using AddressUpgradeable for address;
    using SafeMathUpgradeable for uint256;
    using SignedSafeMathUpgradeable for int256;
    using PerpSafeCast for uint256;
    using PerpSafeCast for int256;
    using PerpMath for uint256;
    using PerpMath for int256;
    using PerpMath for uint160;

    //
    // CONSTANT
    //

    uint256 internal constant _DUST = 10 wei;
    uint256 internal constant _MIN_PARTIAL_LIQUIDATE_POSITION_VALUE = 100e18 wei; // 100 USD in decimal 18

    //
    // EXTERNAL NON-VIEW
    //

    function initialize(address clearingHouseConfigArg) external initializer {
        // IClearingHouseConfig address is not contract
        require(clearingHouseConfigArg.isContract(), "AB_CHCNC");

        __ClearingHouseCallee_init();

        _clearingHouseConfig = clearingHouseConfigArg;
    }

    function setVault(address vaultArg) external onlyOwner {
        // vault address is not contract
        require(vaultArg.isContract(), "AB_VNC");
        _vault = vaultArg;
        emit VaultChanged(vaultArg);
    }

    function setMarketRegistry(address marketRegistryArg) external onlyOwner {
        require(marketRegistryArg.isContract(), "AB_MRNC");
        _marketRegistry = marketRegistryArg;
    }

    function modifyMarketMultiplier(address baseToken, uint256 longRate, uint256 shortRate) external override {
        _requireOnlyClearingHouse();
        if (_marketMap[baseToken].longMultiplierX10_18 == 0) {
            _marketMap[baseToken].longMultiplierX10_18 = 1e18;
        }
        if (_marketMap[baseToken].shortMultiplierX10_18 == 0) {
            _marketMap[baseToken].shortMultiplierX10_18 = 1e18;
        }
        if (longRate != 1e18) {
            _marketMap[baseToken].longMultiplierX10_18 = _marketMap[baseToken].longMultiplierX10_18.mulMultiplier(
                longRate
            );
        }
        if (shortRate != 1e18) {
            _marketMap[baseToken].shortMultiplierX10_18 = _marketMap[baseToken].shortMultiplierX10_18.mulMultiplier(
                shortRate
            );
        }

        emit MultiplierChanged(_marketMap[baseToken].longMultiplierX10_18, _marketMap[baseToken].shortMultiplierX10_18);
    }

    /// @inheritdoc IAccountBalance
    function modifyTakerBalance(
        address trader,
        address baseToken,
        int256 base,
        int256 quote
    ) external override returns (int256, int256) {
        _requireOnlyClearingHouse();
        return _modifyTakerBalance(trader, baseToken, base, quote);
    }

    /// @inheritdoc IAccountBalance
    function modifyOwedRealizedPnl(address trader, address baseToken, int256 amount) external override {
        _requireOnlyClearingHouse();
        _modifyOwedRealizedPnl(trader, amount, baseToken);
    }

    /// @inheritdoc IAccountBalance
    function modifyOwedRealizedPnlForPlatformFee(address trader, address baseToken, int256 amount) external override {
        _requireOnlyClearingHouse();
        _modifyOwedRealizedPnlPlatformFee(trader, amount, baseToken);
    }

    /// @inheritdoc IAccountBalance
    function modifyOwedRealizedPnlForCreatorFee(address trader, address baseToken, int256 amount) external override {
        _requireOnlyClearingHouse();
        _modifyOwedRealizedPnlCreatorFee(trader, amount, baseToken);
    }

    /// @inheritdoc IAccountBalance
    function settleQuoteToOwedRealizedPnl(address trader, address baseToken, int256 amount) external override {
        _requireOnlyClearingHouse();
        _settleQuoteToOwedRealizedPnl(trader, baseToken, amount);
    }

    /// @inheritdoc IAccountBalance
    function settleOwedRealizedPnl(
        address trader,
        address baseToken
    ) external override returns (int256 owedRealizedPnl) {
        // only vault
        require(_msgSender() == _vault, "AB_OV");
        if (_isIsolated(baseToken)) {
            owedRealizedPnl = _isolatedOwedRealizedPnlMap[baseToken][trader];
            _isolatedOwedRealizedPnlMap[baseToken][trader] = 0;
            // revert("TODO");
        } else {
            owedRealizedPnl = _owedRealizedPnlMap[trader];
            _owedRealizedPnlMap[trader] = 0;
        }
        return owedRealizedPnl;
    }

    /// @inheritdoc IAccountBalance
    function settleBalanceAndDeregister(
        address trader,
        address baseToken,
        int256 takerBase,
        int256 takerQuote,
        int256 realizedPnl,
        int256 makerFee
    ) external override {
        _requireOnlyClearingHouse();
        _modifyTakerBalance(trader, baseToken, takerBase, takerQuote);
        _modifyOwedRealizedPnl(trader, makerFee, baseToken);

        // @audit should merge _addOwedRealizedPnl and settleQuoteToOwedRealizedPnl in some way.
        // PnlRealized will be emitted three times when removing trader's liquidity
        _settleQuoteToOwedRealizedPnl(trader, baseToken, realizedPnl);
        _deregisterBaseToken(trader, baseToken);
    }

    /// @inheritdoc IAccountBalance
    function registerBaseToken(address trader, address baseToken) external override {
        _requireOnlyClearingHouse();
        if (_isIsolated(baseToken)) {
            // revert("TODO");
        } else {
            address[] storage tokensStorage = _baseTokensMap[trader];
            if (_hasBaseToken(tokensStorage, baseToken)) {
                return;
            }
            tokensStorage.push(baseToken);
            // AB_MNE: markets number exceeds
            require(
                tokensStorage.length <= IClearingHouseConfig(_clearingHouseConfig).getMaxMarketsPerAccount(),
                "AB_MNE"
            );
        }
    }

    /// @inheritdoc IAccountBalance
    function deregisterBaseToken(address trader, address baseToken) external override {
        _requireOnlyClearingHouse();
        _deregisterBaseToken(trader, baseToken);
    }

    /// @inheritdoc IAccountBalance
    function updateTwPremiumGrowthGlobal(
        address trader,
        address baseToken,
        int256 lastLongTwPremiumGrowthGlobalX96,
        int256 lastShortTwPremiumGrowthGlobalX96
    ) external override {
        _requireOnlyClearingHouse();
        _accountMarketMap[trader][baseToken].lastLongTwPremiumGrowthGlobalX96 = lastLongTwPremiumGrowthGlobalX96;
        _accountMarketMap[trader][baseToken].lastShortTwPremiumGrowthGlobalX96 = lastShortTwPremiumGrowthGlobalX96;
    }

    //
    // EXTERNAL VIEW
    //

    /// @inheritdoc IAccountBalance
    function getClearingHouseConfig() external view override returns (address) {
        return _clearingHouseConfig;
    }

    /// @inheritdoc IAccountBalance
    function getVault() external view override returns (address) {
        return _vault;
    }

    /// @inheritdoc IAccountBalance
    function getBaseTokens(address trader) external view override returns (address[] memory) {
        return _baseTokensMap[trader];
    }

    /// @inheritdoc IAccountBalance
    function getAccountInfo(
        address trader,
        address baseToken
    ) external view override returns (DataTypes.AccountMarketInfo memory) {
        return _accountMarketMap[trader][baseToken];
    }

    // @inheritdoc IAccountBalance
    function getTakerOpenNotional(address trader, address baseToken) external view override returns (int256) {
        return _accountMarketMap[trader][baseToken].takerOpenNotional;
    }

    // @inheritdoc IAccountBalance
    function getTotalOpenNotional(address trader, address baseToken) external view override returns (int256) {
        return getQuote(trader, baseToken);
    }

    /// @inheritdoc IAccountBalance
    // function getTotalDebtValue(address trader) external view override returns (uint256) {
    //     int256 totalQuoteBalance;
    //     int256 totalBaseDebtValue;
    //     uint256 tokenLen = _baseTokensMap[trader].length;
    //     for (uint256 i = 0; i < tokenLen; i++) {
    //         address baseToken = _baseTokensMap[trader][i];
    //         int256 baseBalance = getBase(trader, baseToken);
    //         int256 baseDebtValue;
    //         // baseDebt = baseBalance when it's negative
    //         if (baseBalance < 0) {
    //             // baseDebtValue = baseDebt * indexPrice
    //             baseDebtValue = baseBalance.mulDiv(_getReferencePrice(baseToken).toInt256(), 1e18);
    //         }
    //         totalBaseDebtValue = totalBaseDebtValue.add(baseDebtValue);

    //         // we can't calculate totalQuoteDebtValue until we have totalQuoteBalance
    //         totalQuoteBalance = totalQuoteBalance.add(getQuote(trader, baseToken));
    //     }
    //     int256 totalQuoteDebtValue = totalQuoteBalance >= 0 ? 0 : totalQuoteBalance;

    //     // both values are negative due to the above condition checks
    //     return totalQuoteDebtValue.add(totalBaseDebtValue).abs();
    // }

    /// @inheritdoc IAccountBalance
    function getPnlAndPendingFee(
        address trader,
        address baseToken
    ) external view override returns (int256 _owedRealizedPnl, int256 unrealizedPnl) {
        if (_isIsolated(baseToken)) {
            int256 totalPositionValue = getTotalPositionValue(trader, baseToken);
            int256 netQuoteBalance = _getNetQuoteBalanceAndPendingFee(trader, baseToken);
            unrealizedPnl = totalPositionValue.add(netQuoteBalance);
            _owedRealizedPnl = _isolatedOwedRealizedPnlMap[baseToken][trader];
            // revert("TODO");
        } else {
            int256 totalPositionValue;
            uint256 tokenLen = _baseTokensMap[trader].length;
            for (uint256 i = 0; i < tokenLen; i++) {
                baseToken = _baseTokensMap[trader][i];
                totalPositionValue = totalPositionValue.add(getTotalPositionValue(trader, baseToken));
            }
            int256 netQuoteBalance = _getNetQuoteBalanceAndPendingFee(trader, baseToken);
            unrealizedPnl = totalPositionValue.add(netQuoteBalance);
            _owedRealizedPnl = _owedRealizedPnlMap[trader];
        }
        return (_owedRealizedPnl, unrealizedPnl);
    }

    /// @inheritdoc IAccountBalance
    function getLiquidatablePositionSize(
        address trader,
        address baseToken,
        int256 accountValue
    ) external view override returns (int256) {
        int256 marginRequirement = getMarginRequirementForLiquidation(trader, baseToken);
        int256 positionSize = getTotalPositionSize(trader, baseToken);

        // No liquidatable position
        if (accountValue >= marginRequirement || positionSize == 0) {
            return 0;
        }

        // Liquidate the entire position if its value is small enough
        // to prevent tiny positions left in the system
        uint256 positionValueAbs = _getPositionValue(baseToken, positionSize).abs();
        if (positionValueAbs <= _MIN_PARTIAL_LIQUIDATE_POSITION_VALUE) {
            return positionSize;
        }

        // https://www.notion.so/perp/Backstop-LP-Spec-614b42798d4943768c2837bfe659524d#968996cadaec4c00ac60bd1da02ea8bb
        // Liquidator can only take over partial position if margin ratio is ≥ 3.125% (aka the half of mmRatio).
        // If margin ratio < 3.125%, liquidator can take over the entire position.
        //
        // threshold = mmRatio / 2 = 3.125%
        // if marginRatio >= threshold, then
        //    maxLiquidateRatio = MIN(1, 0.5 * totalAbsPositionValue / absPositionValue)
        // if marginRatio < threshold, then
        //    maxLiquidateRatio = 1
        uint24 maxLiquidateRatio = 1e6; // 100%
        if (accountValue >= marginRequirement.div(2)) {
            // maxLiquidateRatio = getTotalAbsPositionValue / ( getTotalPositionValueInMarket.abs * 2 )
            maxLiquidateRatio = FullMath
                .mulDiv(getTotalAbsPositionValue(trader, baseToken), 1e6, positionValueAbs.mul(2))
                .toUint24();
            if (maxLiquidateRatio > 1e6) {
                maxLiquidateRatio = 1e6;
            }
        }

        return positionSize.mulRatio(maxLiquidateRatio);
    }

    //
    // PUBLIC VIEW
    //

    function getOriginBase(address trader, address baseToken) public view override returns (int256) {
        return _accountMarketMap[trader][baseToken].takerPositionSize;
    }

    /// @inheritdoc IAccountBalance
    function getBase(address trader, address baseToken) public view override returns (int256) {
        int256 base = getOriginBase(trader, baseToken);
        (uint256 longMultiplier, uint256 shortMultiplier) = _getMarketMultiplier(baseToken);
        return base > 0 ? base.mulMultiplier(longMultiplier) : base.mulMultiplier(shortMultiplier);
    }

    /// @inheritdoc IAccountBalance
    function getQuote(address trader, address baseToken) public view override returns (int256) {
        return _accountMarketMap[trader][baseToken].takerOpenNotional;
    }

    function getOriginTakerPositionSize(address trader, address baseToken) public view returns (int256) {
        int256 positionSize = _accountMarketMap[trader][baseToken].takerPositionSize;
        return positionSize.abs() < _DUST ? 0 : positionSize;
    }

    /// @inheritdoc IAccountBalance
    function getTakerPositionSize(address trader, address baseToken) public view override returns (int256) {
        int256 positionSize = getOriginTakerPositionSize(trader, baseToken);
        (uint256 longMultiplier, uint256 shortMultiplier) = _getMarketMultiplier(baseToken);
        return
            positionSize > 0 ? positionSize.mulMultiplier(longMultiplier) : positionSize.mulMultiplier(shortMultiplier);
    }

    function getOriginTotalPositionSize(address trader, address baseToken) public view returns (int256) {
        // NOTE: when a token goes into UniswapV3 pool (addLiquidity or swap), there would be 1 wei rounding error
        // for instance, maker adds liquidity with 2 base (2000000000000000000),
        // the actual base amount in pool would be 1999999999999999999
        int256 takerPositionSize = _accountMarketMap[trader][baseToken].takerPositionSize;
        int256 totalPositionSize = takerPositionSize;
        return totalPositionSize.abs() < _DUST ? 0 : totalPositionSize;
    }

    /// @inheritdoc IAccountBalance
    function getTotalPositionSize(address trader, address baseToken) public view override returns (int256) {
        int256 totalPositionSize = getOriginTotalPositionSize(trader, baseToken);
        (uint256 longMultiplier, uint256 shortMultiplier) = _getMarketMultiplier(baseToken);
        return
            totalPositionSize > 0
                ? totalPositionSize.mulMultiplier(longMultiplier)
                : totalPositionSize.mulMultiplier(shortMultiplier);
    }

    /// @inheritdoc IAccountBalance
    function getTotalPositionValue(address trader, address baseToken) public view override returns (int256) {
        int256 positionSize = getTotalPositionSize(trader, baseToken);
        return _getPositionValue(baseToken, positionSize);
    }

    /// @inheritdoc IAccountBalance
    function getTotalAbsPositionValue(address trader, address baseToken) public view override returns (uint256) {
        uint256 totalPositionValue;
        if (_isIsolated(baseToken)) {
            uint256 positionValue = getTotalPositionValue(trader, baseToken).abs();
            totalPositionValue = totalPositionValue.add(positionValue);
            // revert("TODO");
        } else {
            address[] memory tokens = _baseTokensMap[trader];
            uint256 tokenLen = tokens.length;
            for (uint256 i = 0; i < tokenLen; i++) {
                baseToken = tokens[i];
                // will not use negative value in this case
                uint256 positionValue = getTotalPositionValue(trader, baseToken).abs();
                totalPositionValue = totalPositionValue.add(positionValue);
            }
        }
        return totalPositionValue;
    }

    /// @inheritdoc IAccountBalance
    function getMarginRequirementForLiquidation(
        address trader,
        address baseToken
    ) public view override returns (int256) {
        return
            getTotalAbsPositionValue(trader, baseToken)
                .mulRatio(IClearingHouseConfig(_clearingHouseConfig).getMmRatio())
                .toInt256();
    }

    function getOriginMarketPositionSize(address baseToken) public view returns (uint256, uint256) {
        return (_marketMap[baseToken].longPositionSize, _marketMap[baseToken].shortPositionSize);
    }

    /// @inheritdoc IAccountBalance
    function getMarketPositionSize(address baseToken) public view override returns (uint256, uint256) {
        (uint256 longMultiplier, uint256 shortMultiplier) = _getMarketMultiplier(baseToken);
        return (
            _marketMap[baseToken].longPositionSize.mulMultiplier(longMultiplier),
            _marketMap[baseToken].shortPositionSize.mulMultiplier(shortMultiplier)
        );
    }

    function getMarketMultiplier(
        address baseToken
    ) external view override returns (uint256 longMultiplier, uint256 shortMultiplier) {
        return _getMarketMultiplier(baseToken);
    }

    function _getMarketMultiplier(
        address baseToken
    ) internal view returns (uint256 longMultiplier, uint256 shortMultiplier) {
        longMultiplier = _marketMap[baseToken].longMultiplierX10_18;
        if (longMultiplier == 0) {
            longMultiplier = 1e18;
        }
        shortMultiplier = _marketMap[baseToken].shortMultiplierX10_18;
        if (shortMultiplier == 0) {
            shortMultiplier = 1e18;
        }
    }

    //
    // INTERNAL NON-VIEW
    //
    function getModifyBaseForMultiplier(
        address trader,
        address baseToken,
        int256 baseAfterMultiplier
    ) public view returns (int256 base) {
        DataTypes.AccountMarketInfo storage accountInfo = _accountMarketMap[trader][baseToken];
        // update for multiplier
        {
            (uint256 longMultiplier, uint256 shortMultiplier) = _getMarketMultiplier(baseToken);
            if (longMultiplier == 1e18 && shortMultiplier == 1e18) {
                return baseAfterMultiplier;
            }
            if (accountInfo.takerPositionSize > 0) {
                // in long
                if (baseAfterMultiplier > 0) {
                    base = baseAfterMultiplier.divMultiplier(longMultiplier);
                } else {
                    if (
                        accountInfo.takerPositionSize.abs() >= baseAfterMultiplier.divMultiplier(longMultiplier).abs()
                    ) {
                        base = baseAfterMultiplier.divMultiplier(longMultiplier);
                    } else {
                        int256 rangeBase = accountInfo.takerPositionSize.neg256();
                        base = rangeBase.add(
                            baseAfterMultiplier.sub(rangeBase.mulMultiplier(longMultiplier)).divMultiplier(
                                shortMultiplier
                            )
                        );
                    }
                }
            } else if (accountInfo.takerPositionSize == 0) {
                // in none
                if (baseAfterMultiplier > 0) {
                    base = baseAfterMultiplier.divMultiplier(longMultiplier);
                } else {
                    base = baseAfterMultiplier.divMultiplier(shortMultiplier);
                }
            } else {
                // in short
                if (baseAfterMultiplier < 0) {
                    base = baseAfterMultiplier.divMultiplier(shortMultiplier);
                } else {
                    if (
                        accountInfo.takerPositionSize.abs() >= baseAfterMultiplier.divMultiplier(shortMultiplier).abs()
                    ) {
                        base = baseAfterMultiplier.divMultiplier(shortMultiplier);
                    } else {
                        int256 rangeBase = accountInfo.takerPositionSize.neg256();
                        base = rangeBase.add(
                            baseAfterMultiplier.sub(rangeBase.mulMultiplier(shortMultiplier)).divMultiplier(
                                longMultiplier
                            )
                        );
                    }
                }
            }
        }
    }

    function _modifyTakerBalance(
        address trader,
        address baseToken,
        int256 baseAfterMultiplier,
        int256 quote
    ) internal returns (int256, int256) {
        // for multiplier
        int256 base = getModifyBaseForMultiplier(trader, baseToken, baseAfterMultiplier);
        //
        DataTypes.AccountMarketInfo storage accountInfo = _accountMarketMap[trader][baseToken];
        int256 oldPos = accountInfo.takerPositionSize;
        accountInfo.takerPositionSize = accountInfo.takerPositionSize.add(base);
        accountInfo.takerOpenNotional = accountInfo.takerOpenNotional.add(quote);
        if (oldPos >= 0 && base >= 0) {
            //long
            _marketMap[baseToken].longPositionSize += base.abs();
        } else if (oldPos <= 0 && base <= 0) {
            //short
            _marketMap[baseToken].shortPositionSize += base.abs();
        } else if (oldPos >= 0 && base <= 0) {
            //long => short
            if (accountInfo.takerPositionSize >= 0) {
                //new short <= old long
                _marketMap[baseToken].longPositionSize = _marketMap[baseToken].longPositionSize > base.abs()
                    ? _marketMap[baseToken].longPositionSize - base.abs()
                    : 0;
            } else {
                //new short > old long
                _marketMap[baseToken].longPositionSize = _marketMap[baseToken].longPositionSize > oldPos.abs()
                    ? _marketMap[baseToken].longPositionSize - oldPos.abs()
                    : 0;

                _marketMap[baseToken].shortPositionSize += accountInfo.takerPositionSize.abs();
            }
        } else {
            //short => long
            if (accountInfo.takerPositionSize <= 0) {
                //new long <= old short
                _marketMap[baseToken].shortPositionSize = _marketMap[baseToken].shortPositionSize > base.abs()
                    ? _marketMap[baseToken].shortPositionSize - base.abs()
                    : 0;
            } else {
                //new long > old short
                _marketMap[baseToken].shortPositionSize = _marketMap[baseToken].shortPositionSize > oldPos.abs()
                    ? _marketMap[baseToken].shortPositionSize - oldPos.abs()
                    : 0;
                _marketMap[baseToken].longPositionSize += accountInfo.takerPositionSize.abs();
            }
        }

        return (accountInfo.takerPositionSize, accountInfo.takerOpenNotional);
    }

    function _modifyOwedRealizedPnl(address trader, int256 amount, address baseToken) internal {
        if (amount != 0) {
            if (_isIsolated(baseToken)) {
                _isolatedOwedRealizedPnlMap[baseToken][trader] = _isolatedOwedRealizedPnlMap[baseToken][trader].add(
                    amount
                );
                // revert("TODO");
            } else {
                _owedRealizedPnlMap[trader] = _owedRealizedPnlMap[trader].add(amount);
            }
            emit PnlRealized(trader, baseToken, amount);
        }
    }

    function _modifyOwedRealizedPnlPlatformFee(address trader, int256 amount, address baseToken) internal {
        if (amount != 0) {
            _owedRealizedPnlMap[trader] = _owedRealizedPnlMap[trader].add(amount);
            emit PnlRealizedForPlatformFee(trader, baseToken, amount);
        }
    }

    function _modifyOwedRealizedPnlCreatorFee(address trader, int256 amount, address baseToken) internal {
        if (amount != 0) {
            if (_isIsolated(baseToken)) {
                _isolatedOwedRealizedPnlMap[baseToken][trader] = _isolatedOwedRealizedPnlMap[baseToken][trader].add(
                    amount
                );
                // revert("TODO");
            } else {
                _owedRealizedPnlMap[trader] = _owedRealizedPnlMap[trader].add(amount);
            }
            emit PnlRealizedForCreatorFee(trader, baseToken, amount);
        }
    }

    function _settleQuoteToOwedRealizedPnl(address trader, address baseToken, int256 amount) internal {
        if (amount != 0) {
            DataTypes.AccountMarketInfo storage accountInfo = _accountMarketMap[trader][baseToken];
            accountInfo.takerOpenNotional = accountInfo.takerOpenNotional.sub(amount);
            _modifyOwedRealizedPnl(trader, amount, baseToken);
        }
    }

    /// @dev this function is expensive
    function _deregisterBaseToken(address trader, address baseToken) internal {
        DataTypes.AccountMarketInfo memory info = _accountMarketMap[trader][baseToken];
        if (info.takerPositionSize.abs() >= _DUST || info.takerOpenNotional.abs() >= _DUST) {
            return;
        }
        _deleteBaseToken(trader, baseToken);
    }

    function _deleteBaseToken(address trader, address baseToken) internal {
        DataTypes.AccountMarketInfo memory info = _accountMarketMap[trader][baseToken];
        if (info.takerPositionSize.abs() > 0 && info.takerPositionSize.abs() < _DUST) {
            if (info.takerPositionSize < 0) {
                //update total short
                _marketMap[baseToken].shortPositionSize = _marketMap[baseToken].shortPositionSize >
                    info.takerPositionSize.abs()
                    ? _marketMap[baseToken].shortPositionSize - info.takerPositionSize.abs()
                    : 0;
            } else {
                //update total long
                _marketMap[baseToken].longPositionSize = _marketMap[baseToken].longPositionSize >
                    info.takerPositionSize.abs()
                    ? _marketMap[baseToken].longPositionSize - info.takerPositionSize.abs()
                    : 0;
            }
            // _resetMultiplier(baseToken);
        }
        delete _accountMarketMap[trader][baseToken];

        if (_isIsolated(baseToken)) {
            // update isolated balance -> cross balance
            // revert("TODO");
        } else {
            address[] storage tokensStorage = _baseTokensMap[trader];
            uint256 tokenLen = tokensStorage.length;
            for (uint256 i; i < tokenLen; i++) {
                if (tokensStorage[i] == baseToken) {
                    // if the target to be removed is the last one, pop it directly;
                    // else, replace it with the last one and pop the last one instead
                    if (i != tokenLen - 1) {
                        tokensStorage[i] = tokensStorage[tokenLen - 1];
                    }
                    tokensStorage.pop();
                    break;
                }
            }
        }
    }

    //
    // INTERNAL VIEW
    //

    function _getPositionValue(address baseToken, int256 positionSize) internal view returns (int256) {
        if (positionSize == 0) return 0;

        uint256 markTwap = _getReferencePrice(baseToken); // pnft use mark price
        // uint256 indexTwap = _getReferencePrice(baseToken);
        // both positionSize & indexTwap are in 10^18 already
        // overflow inspection:
        // only overflow when position value in USD(18 decimals) > 2^255 / 10^18
        return positionSize.mulDiv(markTwap.toInt256(), 1e18);
    }

    function _getReferencePrice(address baseToken) internal view returns (uint256) {
        return IVPool(IVault(_vault).getVPool()).getMarkPrice(baseToken);
    }

    function getReferencePrice(address baseToken) external view override returns (uint256) {
        return _getReferencePrice(baseToken);
    }

    /// @return netQuoteBalance = quote.balance + totalQuoteInPools
    function _getNetQuoteBalanceAndPendingFee(
        address trader,
        address baseToken
    ) internal view returns (int256 netQuoteBalance) {
        if (_isIsolated(baseToken)) {
            int256 totalTakerQuoteBalance = _accountMarketMap[trader][baseToken].takerOpenNotional;
            netQuoteBalance = totalTakerQuoteBalance;
            // revert("TODO");
        } else {
            int256 totalTakerQuoteBalance;
            uint256 tokenLen = _baseTokensMap[trader].length;
            for (uint256 i = 0; i < tokenLen; i++) {
                baseToken = _baseTokensMap[trader][i];
                totalTakerQuoteBalance = totalTakerQuoteBalance.add(
                    _accountMarketMap[trader][baseToken].takerOpenNotional
                );
            }
            netQuoteBalance = totalTakerQuoteBalance;
        }
        return netQuoteBalance;
    }

    function _hasBaseToken(address[] memory baseTokens, address baseToken) internal pure returns (bool) {
        for (uint256 i = 0; i < baseTokens.length; i++) {
            if (baseTokens[i] == baseToken) {
                return true;
            }
        }
        return false;
    }

    function _isIsolated(address baseToken) internal view returns (bool) {
        return (IMarketRegistry(_marketRegistry).isIsolated(baseToken));
    }
}
