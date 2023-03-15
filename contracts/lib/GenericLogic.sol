// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma abicoder v2;
import { IAccountBalance } from "../interface/IAccountBalance.sol";
import { IClearingHouse } from "../interface/IClearingHouse.sol";
import { IClearingHouseConfig } from "../interface/IClearingHouseConfig.sol";
import { IVPool } from "../interface/IVPool.sol";
import { IVault } from "../interface/IVault.sol";
import { IMarketRegistry } from "../interface/IMarketRegistry.sol";
import { IInsuranceFund } from "../interface/IInsuranceFund.sol";
import { FullMath } from "@uniswap/v3-core/contracts/libraries/FullMath.sol";
import { PerpSafeCast } from "./PerpSafeCast.sol";
import { PerpMath } from "./PerpMath.sol";
import { SafeMathUpgradeable } from "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import { SignedSafeMathUpgradeable } from "@openzeppelin/contracts-upgradeable/math/SignedSafeMathUpgradeable.sol";
import { DataTypes } from "../types/DataTypes.sol";
import { UniswapV3Broker } from "./UniswapV3Broker.sol";

library GenericLogic {
    using SafeMathUpgradeable for uint256;
    using SignedSafeMathUpgradeable for int256;
    using PerpSafeCast for uint256;
    using PerpSafeCast for uint128;
    using PerpSafeCast for uint24;
    using PerpSafeCast for int256;
    using PerpMath for uint256;
    using PerpMath for uint160;
    using PerpMath for uint128;
    using PerpMath for int256;

    uint256 internal constant _FULLY_CLOSED_RATIO = 1e18;

    //internal struct
    struct InternalCheckSlippageParams {
        bool isBaseToQuote;
        bool isExactInput;
        uint256 base;
        uint256 quote;
        uint256 oppositeAmountBound;
    }

    struct InternalUpdateInfoMultiplierVars {
        bool isBaseToQuote;
        int256 deltaBase;
        uint256 newDeltaBase;
        uint256 newDeltaQuote;
        uint256 newLongPositionSizeRate;
        uint256 newShortPositionSizeRate;
        int256 costDeltaQuote;
        bool isEnoughFund;
    }

    //event

    event FundingPaymentSettled(address indexed trader, address indexed baseToken, int256 fundingPayment);

    event MultiplierCostSpend(address indexed baseToken, int256 cost);

    /// @notice Emitted when taker's position is being changed
    /// @param trader Trader address
    /// @param baseToken The address of virtual base token(ETH, BTC, etc...)
    /// @param exchangedPositionSize The actual amount swap to uniswapV3 pool
    /// @param exchangedPositionNotional The cost of position, include fee
    /// @param fee The fee of open/close position
    /// @param openNotional The cost of open/close position, < 0: long, > 0: short
    /// @param realizedPnl The realized Pnl after open/close position
    /// @param sqrtPriceAfterX96 The sqrt price after swap, in X96
    event PositionChanged(
        address indexed trader,
        address indexed baseToken,
        int256 exchangedPositionSize,
        int256 exchangedPositionNotional,
        uint256 fee,
        int256 openNotional,
        int256 realizedPnl,
        uint256 sqrtPriceAfterX96
    );

    //event
    event PositionLiquidated(
        address indexed trader,
        address indexed baseToken,
        uint256 positionSize,
        uint256 positionNotional,
        uint256 liquidationPenaltyFee,
        address liquidator,
        uint256 liquidatorFee
    );

    /// @notice Emitted when maker's liquidity of a order changed
    /// @param baseToken The address of virtual base token(ETH, BTC, etc...)
    /// @param quoteToken The address of virtual USD token
    /// @param base The amount of base token added (> 0) / removed (< 0) as liquidity; fees not included
    /// @param quote The amount of quote token added ... (same as the above)
    /// @param liquidity The amount of liquidity unit added (> 0) / removed (< 0)
    event LiquidityChanged(
        address indexed baseToken,
        address indexed quoteToken,
        int256 base,
        int256 quote,
        int128 liquidity
    );

    /// @notice Emitted when open position with non-zero referral code
    /// @param referralCode The referral code by partners
    event ReferredPositionChanged(bytes32 indexed referralCode);

    //====================== END Event

    function requireNotMaker(address clearingHouse, address maker) public view {
        // not Maker
        require(maker != IClearingHouse(clearingHouse).getMaker(), "CHD_NM");
    }

    function isLiquidatable(address clearingHouse, address trader, address baseToken) public view returns (bool) {
        return
            getAccountValue(clearingHouse, trader, baseToken) <
            IAccountBalance(IClearingHouse(clearingHouse).getAccountBalance()).getMarginRequirementForLiquidation(
                trader,
                baseToken
            );
    }

    function checkMarketOpen(address clearingHouse, address baseToken) public view {
        // CH_MNO: Market not opened
        require(IVPool(IClearingHouse(clearingHouse).getVPool()).getIndexPrice(baseToken) > 0, "CH_MNO");
    }

    function registerBaseToken(address clearingHouse, address trader, address baseToken) public {
        IAccountBalance(IClearingHouse(clearingHouse).getAccountBalance()).registerBaseToken(trader, baseToken);
    }

    function settleFundingGlobal(
        address clearingHouse,
        address baseToken
    ) public returns (DataTypes.Growth memory fundingGrowthGlobal) {
        (fundingGrowthGlobal) = IVPool(IClearingHouse(clearingHouse).getVPool()).settleFundingGlobal(baseToken);
        return fundingGrowthGlobal;
    }

    function settleFunding(
        address clearingHouse,
        address trader,
        address baseToken
    ) public returns (DataTypes.Growth memory fundingGrowthGlobal, int256 fundingPayment) {
        (fundingPayment, fundingGrowthGlobal) = IVPool(IClearingHouse(clearingHouse).getVPool()).settleFunding(
            trader,
            baseToken
        );
        if (fundingPayment != 0) {
            IAccountBalance(IClearingHouse(clearingHouse).getAccountBalance()).modifyOwedRealizedPnl(
                trader,
                baseToken,
                fundingPayment.neg256()
            );
            emit FundingPaymentSettled(trader, baseToken, fundingPayment);
        }

        IAccountBalance(IClearingHouse(clearingHouse).getAccountBalance()).updateTwPremiumGrowthGlobal(
            trader,
            baseToken,
            fundingGrowthGlobal.twLongPremiumX96,
            fundingGrowthGlobal.twShortPremiumX96
        );
        return (fundingGrowthGlobal, fundingPayment);
    }

    function getFreeCollateralByRatio(
        address clearingHouse,
        address trader,
        uint24 ratio,
        address baseToken
    ) internal view returns (int256) {
        return IVault(IClearingHouse(clearingHouse).getVault()).getFreeCollateralByRatio(trader, ratio, baseToken);
    }

    function checkSlippageAfterLiquidityChange(
        uint256 base,
        uint256 minBase,
        uint256 quote,
        uint256 minQuote
    ) internal pure {
        // CH_PSCF: price slippage check fails
        require(base >= minBase && quote >= minQuote, "CH_PSCF");
    }

    function getSqrtMarkX96(address clearingHouse, address baseToken) public view returns (uint160) {
        return IVPool(IClearingHouse(clearingHouse).getVPool()).getSqrtMarkTwapX96(baseToken, 0);
    }

    function requireEnoughFreeCollateral(address clearingHouse, address trader, address baseToken) public view {
        if (trader == IClearingHouse(clearingHouse).getMaker()) return;
        // CH_NEFCI: not enough free collateral by imRatio
        if (isIsolated(clearingHouse, baseToken)) {
            require(
                getFreeCollateralByRatio(
                    clearingHouse,
                    trader,
                    IClearingHouseConfig(IClearingHouse(clearingHouse).getClearingHouseConfig()).getMmRatio(),
                    baseToken
                ) >= 0,
                "CH_NEFCI"
            );
        } else {
            require(
                getFreeCollateralByRatio(
                    clearingHouse,
                    trader,
                    IClearingHouseConfig(IClearingHouse(clearingHouse).getClearingHouseConfig()).getImRatio(),
                    baseToken
                ) >= 0,
                "CH_NEFCI"
            );
        }
    }

    function requireEnoughFreeCollateralForClose(address clearingHouse, address trader, address baseToken) public view {
        if (trader == IClearingHouse(clearingHouse).getMaker()) return;
        // CH_NEFCM: not enough free collateral by mmRatio
        require(
            getFreeCollateralByRatio(
                clearingHouse,
                trader,
                IClearingHouseConfig(IClearingHouse(clearingHouse).getClearingHouseConfig()).getMmRatio(),
                baseToken
            ) >= 0,
            "CH_NEFCM"
        );
    }

    function requireEnoughCollateralForOrder(
        address clearingHouse,
        uint256 quote,
        uint256 fee,
        uint256 freeCollateralX10_18
    ) public view {
        require(
            freeCollateralX10_18 >=
                quote
                    .mulRatio(IClearingHouseConfig(IClearingHouse(clearingHouse).getClearingHouseConfig()).getImRatio())
                    .add(fee),
            "CH_NEFCO"
        );
    }

    function getTakerOpenNotional(
        address clearingHouse,
        address trader,
        address baseToken
    ) public view returns (int256) {
        return
            IAccountBalance(IClearingHouse(clearingHouse).getAccountBalance()).getTakerOpenNotional(trader, baseToken);
    }

    function getAccountValue(address clearingHouse, address trader, address baseToken) public view returns (int256) {
        return
            IVault(IClearingHouse(clearingHouse).getVault()).getAccountValue(trader, baseToken).parseSettlementToken(
                IVault(IClearingHouse(clearingHouse).getVault()).decimals()
            );
    }

    function checkSlippage(InternalCheckSlippageParams memory params) public pure {
        // skip when params.oppositeAmountBound is zero
        if (params.oppositeAmountBound == 0) {
            return;
        }

        // B2Q + exact input, want more output quote as possible, so we set a lower bound of output quote
        // B2Q + exact output, want less input base as possible, so we set a upper bound of input base
        // Q2B + exact input, want more output base as possible, so we set a lower bound of output base
        // Q2B + exact output, want less input quote as possible, so we set a upper bound of input quote
        if (params.isBaseToQuote) {
            if (params.isExactInput) {
                // too little received when short
                require(params.quote >= params.oppositeAmountBound, "CH_TLRS");
            } else {
                // too much requested when short
                require(params.base <= params.oppositeAmountBound, "CH_TMRS");
            }
        } else {
            if (params.isExactInput) {
                // too little received when long
                require(params.base >= params.oppositeAmountBound, "CH_TLRL");
            } else {
                // too much requested when long
                require(params.quote <= params.oppositeAmountBound, "CH_TMRL");
            }
        }
    }

    function getTakerPositionSafe(
        address clearingHouse,
        address trader,
        address baseToken
    ) public view returns (int256) {
        int256 takerPositionSize = IAccountBalance(IClearingHouse(clearingHouse).getAccountBalance())
            .getTakerPositionSize(trader, baseToken);
        // CH_PSZ: position size is zero
        require(takerPositionSize != 0, "CH_PSZ");
        return takerPositionSize;
    }

    function getOppositeAmount(
        address clearingHouse,
        uint256 oppositeAmountBound,
        bool isPartialClose
    ) public view returns (uint256) {
        return
            isPartialClose
                ? oppositeAmountBound.mulRatio(
                    IClearingHouseConfig(IClearingHouse(clearingHouse).getClearingHouseConfig()).getPartialCloseRatio()
                )
                : oppositeAmountBound;
    }

    function getLiquidationPenaltyRatio(address clearingHouse) public view returns (uint24) {
        return
            IClearingHouseConfig(IClearingHouse(clearingHouse).getClearingHouseConfig()).getLiquidationPenaltyRatio();
    }

    function getIndexPrice(address clearingHouse, address baseToken) internal view returns (uint256) {
        return IVPool(IClearingHouse(clearingHouse).getVPool()).getIndexPrice(baseToken);
    }

    function getInsuranceFundFeeRatio(
        address exchange,
        address marketRegistry,
        address baseToken,
        bool isBaseToQuote
    ) public view returns (uint256) {
        (, uint256 markTwap, uint256 indexTwap) = IVPool(exchange).getFundingGrowthGlobalAndTwaps(baseToken);
        int256 deltaTwapRatio = (markTwap.toInt256().sub(indexTwap.toInt256())).mulDiv(1e6, indexTwap);
        IMarketRegistry.MarketInfo memory marketInfo = IMarketRegistry(marketRegistry).getMarketInfo(baseToken);
        // delta <= 2.5%
        if (deltaTwapRatio.abs() <= marketInfo.optimalDeltaTwapRatio) {
            return marketInfo.insuranceFundFeeRatio;
        }
        if ((isBaseToQuote && deltaTwapRatio > 0) || (!isBaseToQuote && deltaTwapRatio < 0)) {
            return 0;
        }
        // 2.5% < delta <= 5%
        if (
            marketInfo.optimalDeltaTwapRatio < deltaTwapRatio.abs() &&
            deltaTwapRatio.abs() <= marketInfo.unhealthyDeltaTwapRatio
        ) {
            return deltaTwapRatio.abs().mul(marketInfo.optimalFundingRatio).div(1e6);
        }
        // 5% < delta
        return
            PerpMath.min(
                deltaTwapRatio.abs(),
                uint256(IClearingHouseConfig(IVPool(exchange).getClearingHouseConfig()).getMaxFundingRate())
            );
    }

    function getNewPositionSizeForMultiplierRate(
        uint256 longPositionSize,
        uint256 shortPositionSize,
        uint256 oldMarkPrice,
        uint256 newMarkPrice,
        uint256 newDeltaPositionSize
    ) internal pure returns (uint256 newLongPositionSizeRate, uint256 newShortPositionSizeRate) {
        (uint256 newLongPositionSize, uint256 newShortPositionSize) = getNewPositionSizeForMultiplier(
            longPositionSize,
            shortPositionSize,
            oldMarkPrice,
            newMarkPrice,
            newDeltaPositionSize
        );
        newLongPositionSizeRate = longPositionSize != 0 ? newLongPositionSize.divMultiplier(longPositionSize) : 0;
        newShortPositionSizeRate = shortPositionSize != 0 ? newShortPositionSize.divMultiplier(shortPositionSize) : 0;
    }

    function getNewPositionSizeForMultiplier(
        uint256 longPositionSize,
        uint256 shortPositionSize,
        uint256 oldMarkPrice,
        uint256 newMarkPrice,
        uint256 newDeltaPositionSize
    ) internal pure returns (uint256 newLongPositionSize, uint256 newShortPositionSize) {
        newLongPositionSize = longPositionSize;
        newShortPositionSize = shortPositionSize;

        if ((longPositionSize + shortPositionSize) == 0) {
            return (newLongPositionSize, newShortPositionSize);
        }

        if (longPositionSize == shortPositionSize && oldMarkPrice == newMarkPrice) {
            return (newLongPositionSize, newShortPositionSize);
        }

        if (oldMarkPrice != newMarkPrice) {
            // GL_IP: Invalid Price
            require(oldMarkPrice > 0 && newMarkPrice > 0, "GL_IP");
            newLongPositionSize = FullMath.mulDiv(newLongPositionSize, oldMarkPrice, newMarkPrice);
            newShortPositionSize = FullMath.mulDiv(newShortPositionSize, oldMarkPrice, newMarkPrice);
        }

        // ajust to new delta base if newDeltaPositionSize > 0
        if (newDeltaPositionSize > 0) {
            uint256 oldDetalPositionSize = newLongPositionSize.toInt256().sub(newShortPositionSize.toInt256()).abs();
            int256 diffDetalPositionSize = newDeltaPositionSize.toInt256().sub(oldDetalPositionSize.toInt256());
            uint256 newTotalPositionSize = newLongPositionSize.add(newShortPositionSize);

            if (
                (diffDetalPositionSize > 0 && newLongPositionSize > newShortPositionSize) ||
                (diffDetalPositionSize < 0 && newLongPositionSize < newShortPositionSize)
            ) {
                newLongPositionSize = FullMath.mulDiv(
                    newLongPositionSize,
                    (1e18 + FullMath.mulDiv(diffDetalPositionSize.abs(), 1e18, newTotalPositionSize)),
                    1e18
                );
                newShortPositionSize = FullMath.mulDiv(
                    newShortPositionSize,
                    (1e18 - FullMath.mulDiv(diffDetalPositionSize.abs(), 1e18, newTotalPositionSize)),
                    1e18
                );
            } else if (
                (diffDetalPositionSize > 0 && newLongPositionSize < newShortPositionSize) ||
                (diffDetalPositionSize < 0 && newLongPositionSize > newShortPositionSize)
            ) {
                newLongPositionSize = FullMath.mulDiv(
                    newLongPositionSize,
                    (1e18 - FullMath.mulDiv(diffDetalPositionSize.abs(), 1e18, newTotalPositionSize)),
                    1e18
                );
                newShortPositionSize = FullMath.mulDiv(
                    newShortPositionSize,
                    (1e18 + FullMath.mulDiv(diffDetalPositionSize.abs(), 1e18, newTotalPositionSize)),
                    1e18
                );
            }
        }

        return (newLongPositionSize, newShortPositionSize);
    }

    function getInfoMultiplier(
        address clearingHouse,
        address baseToken
    ) public view returns (uint256 oldLongPositionSize, uint256 oldShortPositionSize, uint256 deltaQuote) {
        (oldLongPositionSize, oldShortPositionSize) = IAccountBalance(IClearingHouse(clearingHouse).getAccountBalance())
            .getMarketPositionSize(baseToken);
        int256 oldDeltaBase = oldLongPositionSize.toInt256().sub(oldShortPositionSize.toInt256());
        if (oldDeltaBase != 0) {
            bool isBaseToQuote = oldDeltaBase > 0 ? true : false;
            UniswapV3Broker.ReplaySwapResponse memory estimate = IVPool(IClearingHouse(clearingHouse).getVPool())
                .estimateSwap(
                    DataTypes.OpenPositionParams({
                        baseToken: baseToken,
                        isBaseToQuote: isBaseToQuote,
                        isExactInput: isBaseToQuote,
                        oppositeAmountBound: 0,
                        amount: uint256(oldDeltaBase.abs()),
                        sqrtPriceLimitX96: 0,
                        deadline: block.timestamp + 60,
                        referralCode: ""
                    })
                );
            deltaQuote = isBaseToQuote ? estimate.amountOut : estimate.amountIn;
        }
    }

    function updateInfoMultiplier(
        address clearingHouse,
        address baseToken,
        uint256 longPositionSize,
        uint256 shortPositionSize,
        uint256 oldDeltaQuote,
        uint256 oldMarkPrice,
        uint256 newMarkPrice,
        bool isFixedPositionSize
    ) public {
        InternalUpdateInfoMultiplierVars memory vars;

        vars.deltaBase = longPositionSize.toInt256().sub(shortPositionSize.toInt256());
        vars.isBaseToQuote = vars.deltaBase > 0 ? true : false;

        // update new size by price
        {
            (vars.newLongPositionSizeRate, vars.newShortPositionSizeRate) = getNewPositionSizeForMultiplierRate(
                longPositionSize,
                shortPositionSize,
                oldMarkPrice,
                newMarkPrice,
                0
            );
            IAccountBalance(IClearingHouse(clearingHouse).getAccountBalance()).modifyMarketMultiplier(
                baseToken,
                vars.newLongPositionSizeRate,
                vars.newShortPositionSizeRate
            );
        }

        (longPositionSize, shortPositionSize) = IAccountBalance(IClearingHouse(clearingHouse).getAccountBalance())
            .getMarketPositionSize(baseToken);

        vars.deltaBase = longPositionSize.toInt256().sub(shortPositionSize.toInt256());
        if (vars.deltaBase != 0) {
            UniswapV3Broker.ReplaySwapResponse memory estimate = IVPool(IClearingHouse(clearingHouse).getVPool())
                .estimateSwap(
                    DataTypes.OpenPositionParams({
                        baseToken: baseToken,
                        isBaseToQuote: vars.isBaseToQuote,
                        isExactInput: vars.isBaseToQuote,
                        oppositeAmountBound: 0,
                        amount: vars.deltaBase.abs(),
                        sqrtPriceLimitX96: 0,
                        deadline: block.timestamp + 60,
                        referralCode: ""
                    })
                );
            vars.newDeltaQuote = vars.isBaseToQuote ? estimate.amountOut : estimate.amountIn;
            vars.costDeltaQuote = (
                vars.isBaseToQuote
                    ? vars.newDeltaQuote.toInt256().sub(oldDeltaQuote.toInt256())
                    : oldDeltaQuote.toInt256().sub(vars.newDeltaQuote.toInt256())
            );
        }

        if (!isFixedPositionSize) {
            // for repeg price
            // estimate for check cost and fund
            vars.isEnoughFund = false;
            if (vars.costDeltaQuote > 0) {
                int256 remainDistributedFund = IInsuranceFund(IClearingHouse(clearingHouse).getInsuranceFund())
                    .getRepegAccumulatedFund(baseToken)
                    .sub(
                        IInsuranceFund(IClearingHouse(clearingHouse).getInsuranceFund()).getRepegDistributedFund(
                            baseToken
                        )
                    );
                int256 insuranceFundCapacity = IInsuranceFund(IClearingHouse(clearingHouse).getInsuranceFund())
                    .getInsuranceFundCapacity(baseToken);
                if (remainDistributedFund >= vars.costDeltaQuote) {
                    if (insuranceFundCapacity >= vars.costDeltaQuote) {
                        vars.isEnoughFund = true;
                    }
                }
                if (!vars.isEnoughFund) {
                    // using cost with owedRealizedPnl from insuranceFund
                    vars.costDeltaQuote = PerpMath.min(
                        vars.costDeltaQuote,
                        PerpMath.min(
                            remainDistributedFund > 0 ? remainDistributedFund : 0,
                            insuranceFundCapacity > 0 ? insuranceFundCapacity : 0
                        )
                    );
                }
            } else {
                vars.isEnoughFund = true;
            }
            if (!vars.isEnoughFund) {
                // estimate cost to base
                UniswapV3Broker.ReplaySwapResponse memory estimate = IVPool(IClearingHouse(clearingHouse).getVPool())
                    .estimateSwap(
                        DataTypes.OpenPositionParams({
                            baseToken: baseToken,
                            isBaseToQuote: vars.isBaseToQuote,
                            isExactInput: !vars.isBaseToQuote,
                            oppositeAmountBound: 0,
                            amount: (
                                vars.isBaseToQuote
                                    ? oldDeltaQuote.add(vars.costDeltaQuote.abs())
                                    : oldDeltaQuote.sub(vars.costDeltaQuote.abs())
                            ),
                            sqrtPriceLimitX96: 0,
                            deadline: block.timestamp + 60,
                            referralCode: ""
                        })
                    );
                vars.newDeltaBase = vars.isBaseToQuote ? estimate.amountIn : estimate.amountOut;
                (vars.newLongPositionSizeRate, vars.newShortPositionSizeRate) = getNewPositionSizeForMultiplierRate(
                    longPositionSize,
                    shortPositionSize,
                    newMarkPrice,
                    newMarkPrice,
                    vars.newDeltaBase
                );
                IAccountBalance(IClearingHouse(clearingHouse).getAccountBalance()).modifyMarketMultiplier(
                    baseToken,
                    vars.newLongPositionSizeRate,
                    vars.newShortPositionSizeRate
                );
            }
        }
        if (vars.costDeltaQuote != 0) {
            // update repeg fund
            IInsuranceFund(IClearingHouse(clearingHouse).getInsuranceFund()).repegFund(vars.costDeltaQuote, baseToken);
            // update RealizedPnl for InsuranceFund
            IAccountBalance(IClearingHouse(clearingHouse).getAccountBalance()).modifyOwedRealizedPnl(
                IClearingHouse(clearingHouse).getInsuranceFund(),
                baseToken,
                vars.costDeltaQuote.neg256()
            );
            // check RealizedPnl for InsuranceFund after repeg
            int256 insuranceFundCapacity = IInsuranceFund(IClearingHouse(clearingHouse).getInsuranceFund())
                .getInsuranceFundCapacity(baseToken);
            // GL_INE: InsuranceFund not fee fund
            require(insuranceFundCapacity >= 0, "GL_INFF");
            // emit event
            emit MultiplierCostSpend(baseToken, vars.costDeltaQuote);
        }
    }

    function addLiquidity(
        address clearingHouse,
        DataTypes.AddLiquidityParams calldata params
    )
        public
        returns (
            // check onlyLiquidityAdmin
            DataTypes.AddLiquidityResponse memory
        )
    {
        // input requirement checks:
        //   baseToken: in Exchange.settleFunding()
        //   base & quote: in LiquidityAmounts.getLiquidityForAmounts() -> FullMath.mulDiv()
        //   lowerTick & upperTick: in UniswapV3Pool._modifyPosition()
        //   minBase, minQuote & deadline: here

        // checkMarketOpen(clearingHouse, params.baseToken);

        // This condition is to prevent the intentional bad debt attack through price manipulation.
        // CH_OMPS: Over the maximum price spread
        // require(!IVPool(IClearingHouse(clearingHouse).getVPool()).isOverPriceSpread(params.baseToken), "CH_OMPS");

        settleFundingGlobal(clearingHouse, params.baseToken);

        // for multiplier
        (uint256 oldLongPositionSize, uint256 oldShortPositionSize, uint256 oldDeltaQuote) = getInfoMultiplier(
            clearingHouse,
            params.baseToken
        );
        // for multiplier

        // note that we no longer check available tokens here because CH will always auto-mint in UniswapV3MintCallback
        UniswapV3Broker.AddLiquidityResponse memory response = UniswapV3Broker.addLiquidity(
            IMarketRegistry(IClearingHouse(clearingHouse).getMarketRegistry()).getPool(params.baseToken),
            UniswapV3Broker.AddLiquidityParams({ baseToken: params.baseToken, liquidity: params.liquidity })
        );

        // CHL_MAL: max liq
        require(
            IClearingHouse(clearingHouse).getLiquidity(params.baseToken) <=
                PerpMath.calculateLiquidity(
                    IMarketRegistry(IClearingHouse(clearingHouse).getMarketRegistry()).getMaxQuoteTickCrossedGlobal(),
                    10000,
                    IVPool(IClearingHouse(clearingHouse).getVPool()).getMarkPrice(params.baseToken)
                ),
            "CHL_MAL"
        );

        // for multiplier
        updateInfoMultiplier(
            clearingHouse,
            params.baseToken,
            oldLongPositionSize,
            oldShortPositionSize,
            oldDeltaQuote,
            0,
            0,
            true
        );
        // for multiplier

        emit LiquidityChanged(
            params.baseToken,
            IClearingHouse(clearingHouse).getQuoteToken(),
            response.base.toInt256(),
            response.quote.toInt256(),
            response.liquidity.toInt128()
        );

        return
            DataTypes.AddLiquidityResponse({
                base: response.base,
                quote: response.quote,
                liquidity: response.liquidity
            });
    }

    function removeLiquidity(
        address clearingHouse,
        DataTypes.RemoveLiquidityParams memory params
    ) public returns (DataTypes.RemoveLiquidityResponse memory) {
        // input requirement checks:
        //   baseToken: in Exchange.settleFunding()
        //   lowerTick & upperTick: in UniswapV3Pool._modifyPosition()
        //   liquidity: in LiquidityMath.addDelta()
        //   minBase, minQuote & deadline: here

        settleFundingGlobal(clearingHouse, params.baseToken);

        // for multiplier
        (uint256 oldLongPositionSize, uint256 oldShortPositionSize, uint256 oldDeltaQuote) = getInfoMultiplier(
            clearingHouse,
            params.baseToken
        );
        // for multiplier

        // must settle funding first

        UniswapV3Broker.RemoveLiquidityResponse memory response = UniswapV3Broker.removeLiquidity(
            IMarketRegistry(IClearingHouse(clearingHouse).getMarketRegistry()).getPool(params.baseToken),
            clearingHouse,
            UniswapV3Broker.RemoveLiquidityParams({ baseToken: params.baseToken, liquidity: params.liquidity })
        );

        // CHL_MIL: min liq
        require(
            IClearingHouse(clearingHouse).getLiquidity(params.baseToken) >=
                PerpMath.calculateLiquidity(
                    IMarketRegistry(IClearingHouse(clearingHouse).getMarketRegistry()).getMinQuoteTickCrossedGlobal(),
                    10000,
                    IVPool(IClearingHouse(clearingHouse).getVPool()).getMarkPrice(params.baseToken)
                ),
            "CHL_MIL"
        );

        // for multiplier
        updateInfoMultiplier(
            clearingHouse,
            params.baseToken,
            oldLongPositionSize,
            oldShortPositionSize,
            oldDeltaQuote,
            0,
            0,
            true
        );
        // for multiplier

        emit LiquidityChanged(
            params.baseToken,
            IClearingHouse(clearingHouse).getQuoteToken(),
            response.base.neg256(),
            response.quote.neg256(),
            params.liquidity.neg128()
        );

        return DataTypes.RemoveLiquidityResponse({ quote: response.quote, base: response.base });
    }

    function modifyOwedRealizedPnlForPlatformFee(address clearingHouse, address baseToken, uint256 amount) external {
        address platformFund = IClearingHouse(clearingHouse).getPlatformFund();
        int256 platformFundFee;
        if (isIsolated(clearingHouse, baseToken)) {
            address insuranceFund = IClearingHouse(clearingHouse).getInsuranceFund();
            uint24 shareFeeRatio = IMarketRegistry(IClearingHouse(clearingHouse).getMarketRegistry())
                .getSharePlatformFeeRatioGlobal();
            // for isolated platform fee
            int256 insurancePlatformFee = amount.toInt256().mulRatio(shareFeeRatio);
            IAccountBalance(IClearingHouse(clearingHouse).getAccountBalance())
                .modifyOwedRealizedPnlForInsurancePlatformFee(insuranceFund, baseToken, insurancePlatformFee);
            IInsuranceFund(insuranceFund).modifyPlatformFee(baseToken, insurancePlatformFee);
            // for platform
            platformFundFee = amount.toInt256().sub(insurancePlatformFee);
            // revert("TODO");
        } else {
            platformFundFee = amount.toInt256();
        }
        IAccountBalance(IClearingHouse(clearingHouse).getAccountBalance()).modifyOwedRealizedPnlForPlatformFee(
            platformFund,
            baseToken,
            platformFundFee
        );
    }

    function modifyOwedRealizedPnlForInsuranceFundFee(
        address clearingHouse,
        address baseToken,
        uint256 amount
    ) external {
        address insuranceFund = IClearingHouse(clearingHouse).getInsuranceFund();
        // update repeg fund
        if (isIsolated(clearingHouse, baseToken)) {
            IInsuranceFund(insuranceFund).addContributionFund(baseToken, insuranceFund, amount);
        } else {
            IInsuranceFund(insuranceFund).addRepegFund(amount.div(2), baseToken);
        }
        IAccountBalance(IClearingHouse(clearingHouse).getAccountBalance()).modifyOwedRealizedPnl(
            insuranceFund,
            baseToken,
            amount.toInt256()
        );
    }

    function isIsolated(address clearingHouse, address baseToken) public view returns (bool) {
        return (IMarketRegistry(IClearingHouse(clearingHouse).getMarketRegistry()).isIsolated(baseToken));
    }
}
