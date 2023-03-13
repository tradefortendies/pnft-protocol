// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma abicoder v2;
import { IAccountBalance } from "../interface/IAccountBalance.sol";
import { IInsuranceFund } from "../interface/IInsuranceFund.sol";
import { IClearingHouse } from "../interface/IClearingHouse.sol";
import { IClearingHouseConfig } from "../interface/IClearingHouseConfig.sol";
import { IVPool } from "../interface/IVPool.sol";
import { IVault } from "../interface/IVault.sol";
import { IMarketRegistry } from "../interface/IMarketRegistry.sol";
import { IRewardMiner } from "../interface/IRewardMiner.sol";
import { FullMath } from "@uniswap/v3-core/contracts/libraries/FullMath.sol";
import { PerpSafeCast } from "./PerpSafeCast.sol";
import { PerpMath } from "./PerpMath.sol";
import { SafeMathUpgradeable } from "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import { SignedSafeMathUpgradeable } from "@openzeppelin/contracts-upgradeable/math/SignedSafeMathUpgradeable.sol";
import { SafeERC20Upgradeable, IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import { DataTypes } from "../types/DataTypes.sol";
import { GenericLogic } from "../lib/GenericLogic.sol";
import { UniswapV3Broker } from "../lib/UniswapV3Broker.sol";
import "hardhat/console.sol";

library ClearingHouseLogic {
    using SafeMathUpgradeable for uint256;
    using SignedSafeMathUpgradeable for int256;
    using PerpSafeCast for uint256;
    using PerpSafeCast for uint128;
    using PerpSafeCast for int256;
    using PerpMath for uint256;
    using PerpMath for uint160;
    using PerpMath for uint128;
    using PerpMath for int256;

    uint256 internal constant _BAD_AMOUNT = 1e10; // 15 sec

    event RealizedPnlTransfer(address indexed from, address indexed to, address indexed baseToken, uint256 amount);

    event Repeg(address indexed baseToken, uint256 oldMarkPrice, uint256 newMarkPrice);

    //internal struct
    /// @param sqrtPriceLimitX96 tx will fill until it reaches this price but WON'T REVERT
    struct InternalOpenPositionParams {
        address trader;
        address baseToken;
        bool isBaseToQuote;
        bool isExactInput;
        bool isClose;
        uint256 amount;
        uint160 sqrtPriceLimitX96;
    }

    struct InternalSwapResponse {
        int256 base;
        int256 quote;
        int256 exchangedPositionSize;
        int256 exchangedPositionNotional;
        uint256 fee;
        int24 tick;
    }

    struct InternalLiquidateParams {
        address clearingHouse;
        address marketRegistry;
        address liquidator;
        address trader;
        address baseToken;
        int256 positionSizeToBeLiquidated;
        bool isForced;
    }

    struct InternalLiquidateVars {
        int256 positionSize;
        int256 openNotional;
        uint256 liquidationPenalty;
        int256 accountValue;
        int256 liquidatedPositionSize;
        int256 liquidatedPositionNotional;
        uint256 liquidationFeeToLiquidator;
        uint256 liquidationFeeToIF;
        int256 liquidatorExchangedPositionNotional;
        int256 accountValueAfterLiquidationX10_18;
        int256 insuranceFundCapacityX10_18;
        int256 liquidatorExchangedPositionSize;
        address insuranceFund;
        int256 traderRealizedPnl;
        int256 liquidatorRealizedPnl;
    }

    struct InternalRepegVars {
        uint160 oldSqrtMarkPrice;
        uint256 oldMarkPrice;
        uint160 newSqrtMarkPrice;
        uint256 newMarkPrice;
        uint256 spotPrice;
        uint160 sqrtSpotPrice;
        int256 oldDeltaBase;
        uint256 newDeltaBase;
        uint256 oldLongPositionSize;
        uint256 oldShortPositionSize;
        uint256 oldDeltaQuote;
    }

    //
    function _openPosition(
        address clearingHouse,
        InternalOpenPositionParams memory params
    ) internal returns (IVPool.SwapResponse memory) {
        // must settle funding first
        (, int256 fundingPayment) = GenericLogic.settleFunding(clearingHouse, params.trader, params.baseToken);

        IVPool.SwapResponse memory response = IVPool(IClearingHouse(clearingHouse).getVPool()).swap(
            IVPool.SwapParams({
                trader: params.trader,
                baseToken: params.baseToken,
                isBaseToQuote: params.isBaseToQuote,
                isExactInput: params.isExactInput,
                isClose: params.isClose,
                amount: params.amount,
                sqrtPriceLimitX96: params.sqrtPriceLimitX96
            })
        );

        // EL_DA: DUST Amount
        require(
            response.exchangedPositionSize.abs() >= _BAD_AMOUNT ||
                response.exchangedPositionNotional.abs() >= _BAD_AMOUNT,
            "EL_DA"
        );
        // platformFundFee
        GenericLogic.modifyOwedRealizedPnlForPlatformFee(clearingHouse, params.baseToken, response.platformFundFee);
        // insuranceFundFee
        GenericLogic.modifyOwedRealizedPnlForInsuranceFundFee(
            clearingHouse,
            params.baseToken,
            response.insuranceFundFee
        );
        // sum fee, sub direct balance
        uint256 fee = response.insuranceFundFee.add(response.platformFundFee);
        _modifyOwedRealizedPnl(clearingHouse, params.trader, params.baseToken, fee.toInt256().neg256());

        // examples:
        // https://www.figma.com/file/xuue5qGH4RalX7uAbbzgP3/swap-accounting-and-events?node-id=0%3A1
        IAccountBalance(IClearingHouse(clearingHouse).getAccountBalance()).settleBalanceAndDeregister(
            params.trader,
            params.baseToken,
            response.exchangedPositionSize,
            response.exchangedPositionNotional,
            response.pnlToBeRealized,
            0
        );

        if (response.pnlToBeRealized != 0) {
            // if realized pnl is not zero, that means trader is reducing or closing position
            // trader cannot reduce/close position if the remaining account value is less than
            // accountValue * LiquidationPenaltyRatio, which
            // enforces traders to keep LiquidationPenaltyRatio of accountValue to
            // shore the remaining positions and make sure traders having enough money to pay liquidation penalty.

            // CH_NEMRM : not enough minimum required margin after reducing/closing position
            require(
                GenericLogic.getAccountValue(clearingHouse, params.trader, params.baseToken) >=
                    IAccountBalance(IClearingHouse(clearingHouse).getAccountBalance())
                        .getTotalAbsPositionValue(params.trader, params.baseToken)
                        .mulRatio(
                            IClearingHouseConfig(IClearingHouse(clearingHouse).getClearingHouseConfig())
                                .getLiquidationPenaltyRatio()
                        )
                        .toInt256(),
                "CH_NEMRM"
            );
        }

        // if not closing a position, check margin ratio after swap
        if (params.isClose) {
            GenericLogic.requireEnoughFreeCollateralForClose(clearingHouse, params.trader, params.baseToken);
        } else {
            GenericLogic.requireEnoughFreeCollateral(clearingHouse, params.trader, params.baseToken);
        }

        // openNotional will be zero if baseToken is deregistered from trader's token list.
        int256 openNotional = GenericLogic.getTakerOpenNotional(clearingHouse, params.trader, params.baseToken);
        emit GenericLogic.PositionChanged(
            params.trader,
            params.baseToken,
            response.exchangedPositionSize,
            response.exchangedPositionNotional,
            fee,
            openNotional,
            response.pnlToBeRealized, // realizedPnl
            response.sqrtPriceAfterX96
        );

        // for miner amount
        rewardMinerMint(
            clearingHouse,
            params.trader,
            response.quote,
            fee.toInt256().neg256().add(response.pnlToBeRealized).add(fundingPayment.neg256())
        );

        return response;
    }

    function openPositionFor(
        address clearingHouse,
        address trader,
        DataTypes.OpenPositionParams memory params
    ) public returns (uint256 base, uint256 quote, uint256 fee) {
        // input requirement checks:
        //   baseToken: in Exchange.settleFunding()
        //   isBaseToQuote & isExactInput: X
        //   amount: in UniswapV3Pool.swap()
        //   oppositeAmountBound: in _checkSlippage()
        //   deadline: here
        //   sqrtPriceLimitX96: X (this is not for slippage protection)
        //   referralCode: X

        GenericLogic.checkMarketOpen(clearingHouse, params.baseToken);

        GenericLogic.requireNotMaker(clearingHouse, trader);

        // register token if it's the first time
        GenericLogic.registerBaseToken(clearingHouse, trader, params.baseToken);

        IVPool.SwapResponse memory response = _openPosition(
            clearingHouse,
            InternalOpenPositionParams({
                trader: trader,
                baseToken: params.baseToken,
                isBaseToQuote: params.isBaseToQuote,
                isExactInput: params.isExactInput,
                amount: params.amount,
                isClose: false,
                sqrtPriceLimitX96: params.sqrtPriceLimitX96
            })
        );

        GenericLogic.checkSlippage(
            GenericLogic.InternalCheckSlippageParams({
                isBaseToQuote: params.isBaseToQuote,
                isExactInput: params.isExactInput,
                base: response.base,
                quote: response.quote,
                oppositeAmountBound: params.oppositeAmountBound
            })
        );

        _referredPositionChanged(params.referralCode);

        return (response.base, response.quote, response.insuranceFundFee.add(response.platformFundFee));
    }

    function _referredPositionChanged(bytes32 referralCode) internal {
        if (referralCode != 0) {
            emit GenericLogic.ReferredPositionChanged(referralCode);
        }
    }

    function closePosition(
        address clearingHouse,
        address trader,
        DataTypes.ClosePositionParams calldata params
    ) public returns (uint256 base, uint256 quote, uint256 fee) {
        // input requirement checks:
        //   baseToken: in Exchange.settleFunding()
        //   sqrtPriceLimitX96: X (this is not for slippage protection)
        //   oppositeAmountBound: in _checkSlippage()
        //   deadline: here
        //   referralCode: X

        GenericLogic.checkMarketOpen(clearingHouse, params.baseToken);

        GenericLogic.requireNotMaker(clearingHouse, trader);

        int256 positionSize = GenericLogic.getTakerPositionSafe(clearingHouse, trader, params.baseToken);

        // old position is long. when closing, it's baseToQuote && exactInput (sell exact base)
        // old position is short. when closing, it's quoteToBase && exactOutput (buy exact base back)
        bool isBaseToQuote = positionSize > 0;

        IVPool.SwapResponse memory response = _openPosition(
            clearingHouse,
            InternalOpenPositionParams({
                trader: trader,
                baseToken: params.baseToken,
                isBaseToQuote: isBaseToQuote,
                isExactInput: isBaseToQuote,
                isClose: true,
                amount: positionSize.abs(),
                sqrtPriceLimitX96: params.sqrtPriceLimitX96
            })
        );

        GenericLogic.checkSlippage(
            GenericLogic.InternalCheckSlippageParams({
                isBaseToQuote: isBaseToQuote,
                isExactInput: isBaseToQuote,
                base: response.base,
                quote: response.quote,
                oppositeAmountBound: GenericLogic.getOppositeAmount(
                    clearingHouse,
                    params.oppositeAmountBound,
                    response.isPartialClose
                )
            })
        );

        _referredPositionChanged(params.referralCode);

        return (response.base, response.quote, response.insuranceFundFee.add(response.platformFundFee));
    }

    function rewardMinerMint(address clearingHouse, address trader, uint256 quote, int256 pnl) public {
        address rewardMiner = IClearingHouse(clearingHouse).getRewardMiner();
        if (rewardMiner != address(0)) {
            IRewardMiner(rewardMiner).mint(trader, quote, pnl);
        }
    }

    function _getLiquidatedPositionSizeAndNotional(
        address clearingHouse,
        address trader,
        address baseToken,
        int256 accountValue,
        int256 positionSizeToBeLiquidated
    ) internal view returns (int256, int256) {
        int256 maxLiquidatablePositionSize = IAccountBalance(IClearingHouse(clearingHouse).getAccountBalance())
            .getLiquidatablePositionSize(trader, baseToken, accountValue);

        if (positionSizeToBeLiquidated.abs() > maxLiquidatablePositionSize.abs() || positionSizeToBeLiquidated == 0) {
            positionSizeToBeLiquidated = maxLiquidatablePositionSize;
        }

        int256 markPrice = GenericLogic
            .getSqrtMarkX96(clearingHouse, baseToken)
            .formatSqrtPriceX96ToPriceX96()
            .formatX96ToX10_18()
            .toInt256();

        int256 liquidatedPositionSize = positionSizeToBeLiquidated.neg256();
        int256 liquidatedPositionNotional = positionSizeToBeLiquidated.mulDiv(markPrice, 1e18);

        return (liquidatedPositionSize, liquidatedPositionNotional);
    }

    function _modifyOwedRealizedPnl(address clearingHouse, address trader, address baseToken, int256 amount) internal {
        IAccountBalance(IClearingHouse(clearingHouse).getAccountBalance()).modifyOwedRealizedPnl(
            trader,
            baseToken,
            amount
        );
    }

    /// @dev Calculate how much profit/loss we should realize,
    ///      The profit/loss is calculated by exchangedPositionSize/exchangedPositionNotional amount
    ///      and existing taker's base/quote amount.
    function _modifyPositionAndRealizePnl(
        address clearingHouse,
        address trader,
        address baseToken,
        int256 exchangedPositionSize,
        int256 exchangedPositionNotional,
        uint256 makerFee,
        uint256 takerFee
    ) internal returns (int256 realizedPnl) {
        if (exchangedPositionSize != 0) {
            realizedPnl = IVPool(IClearingHouse(clearingHouse).getVPool()).getPnlToBeRealized(
                IVPool.RealizePnlParams({
                    trader: trader,
                    baseToken: baseToken,
                    base: exchangedPositionSize,
                    quote: exchangedPositionNotional
                })
            );
        }

        // realizedPnl is realized here
        // will deregister baseToken if there is no position
        IAccountBalance(IClearingHouse(clearingHouse).getAccountBalance()).settleBalanceAndDeregister(
            trader,
            baseToken,
            exchangedPositionSize, // takerBase
            exchangedPositionNotional, // takerQuote
            realizedPnl,
            makerFee.toInt256()
        );
        int256 openNotional = GenericLogic.getTakerOpenNotional(clearingHouse, trader, baseToken);
        uint160 currentPrice = GenericLogic.getSqrtMarkX96(clearingHouse, baseToken);
        emit GenericLogic.PositionChanged(
            trader,
            baseToken,
            exchangedPositionSize,
            exchangedPositionNotional,
            takerFee, // fee
            openNotional, // openNotional
            realizedPnl,
            currentPrice // sqrtPriceAfterX96: no swap, so market price didn't change
        );
    }

    function liquidate(
        InternalLiquidateParams memory params
    ) public returns (uint256 base, uint256 quote, uint256 fee) {
        InternalLiquidateVars memory vars;

        GenericLogic.checkMarketOpen(params.clearingHouse, params.baseToken);

        GenericLogic.requireNotMaker(params.clearingHouse, params.trader);

        if (!params.isForced) {
            // CH_EAV: enough account value
            require(GenericLogic.isLiquidatable(params.clearingHouse, params.trader, params.baseToken), "CH_EAV");
        }

        vars.positionSize = GenericLogic.getTakerPositionSafe(params.clearingHouse, params.trader, params.baseToken);
        vars.openNotional = IAccountBalance(IClearingHouse(params.clearingHouse).getAccountBalance())
            .getTakerOpenNotional(params.trader, params.baseToken);

        // CH_WLD: wrong liquidation direction
        require(vars.positionSize.mul(params.positionSizeToBeLiquidated) >= 0, "CH_WLD");

        GenericLogic.registerBaseToken(params.clearingHouse, params.liquidator, params.baseToken);

        // must settle funding first
        GenericLogic.settleFunding(params.clearingHouse, params.trader, params.baseToken);
        GenericLogic.settleFunding(params.clearingHouse, params.liquidator, params.baseToken);

        vars.accountValue = GenericLogic.getAccountValue(params.clearingHouse, params.trader, params.baseToken);

        // trader's position is closed at index price and pnl realized
        (vars.liquidatedPositionSize, vars.liquidatedPositionNotional) = _getLiquidatedPositionSizeAndNotional(
            params.clearingHouse,
            params.trader,
            params.baseToken,
            vars.accountValue,
            params.positionSizeToBeLiquidated
        );

        vars.traderRealizedPnl = _modifyPositionAndRealizePnl(
            params.clearingHouse,
            params.trader,
            params.baseToken,
            vars.liquidatedPositionSize,
            vars.liquidatedPositionNotional,
            0,
            0
        );

        // trader pays liquidation penalty
        vars.liquidationPenalty = vars.liquidatedPositionNotional.abs().mulRatio(
            GenericLogic.getLiquidationPenaltyRatio(params.clearingHouse)
        );
        IAccountBalance(IClearingHouse(params.clearingHouse).getAccountBalance()).modifyOwedRealizedPnl(
            params.trader,
            params.baseToken,
            vars.liquidationPenalty.neg256()
        );

        // if there is bad debt, liquidation fees all go to liquidator; otherwise, split between liquidator & IF
        vars.liquidationFeeToLiquidator = vars.liquidationPenalty.div(2);
        vars.liquidationFeeToIF;
        if (vars.accountValue < 0) {
            vars.liquidationFeeToLiquidator = vars.liquidationPenalty;
        } else {
            vars.liquidationFeeToIF = vars.liquidationPenalty.sub(vars.liquidationFeeToLiquidator);
            GenericLogic.modifyOwedRealizedPnlForInsuranceFundFee(
                params.clearingHouse,
                params.baseToken,
                vars.liquidationFeeToIF
            );
        }

        // assume there is no longer any unsettled bad debt in the system
        // (so that true IF capacity = accountValue(IF) + USDC.balanceOf(IF))
        // if trader's account value becomes negative, the amount is the bad debt IF must have enough capacity to cover
        {
            vars.accountValueAfterLiquidationX10_18 = GenericLogic.getAccountValue(
                params.clearingHouse,
                params.trader,
                params.baseToken
            );
            if (vars.accountValueAfterLiquidationX10_18 < 0) {
                vars.insuranceFund = IClearingHouse(params.clearingHouse).getInsuranceFund();
                vars.insuranceFundCapacityX10_18 = IInsuranceFund(vars.insuranceFund)
                    .getInsuranceFundCapacity(params.baseToken)
                    .parseSettlementToken(IVault(IClearingHouse(params.clearingHouse).getVault()).decimals());

                // CH_IIC: insufficient insuranceFund capacity
                require(vars.insuranceFundCapacityX10_18 >= vars.accountValueAfterLiquidationX10_18.neg256(), "CH_IIC");
            }
        }

        // liquidator opens a position with liquidationFeeToLiquidator as a discount
        // liquidator's openNotional = -liquidatedPositionNotional + liquidationFeeToLiquidator
        vars.liquidatorExchangedPositionSize = vars.liquidatedPositionSize.neg256();
        vars.liquidatorExchangedPositionNotional = vars.liquidatedPositionNotional.neg256();
        // note that this function will realize pnl if it's reducing liquidator's existing position size
        vars.liquidatorRealizedPnl = _modifyPositionAndRealizePnl(
            params.clearingHouse,
            params.liquidator,
            params.baseToken,
            vars.liquidatorExchangedPositionSize, // exchangedPositionSize
            vars.liquidatorExchangedPositionNotional, // exchangedPositionNotional
            0, // makerFee
            0 // takerFee
        );
        // add fee to pnl
        IAccountBalance(IClearingHouse(params.clearingHouse).getAccountBalance()).modifyOwedRealizedPnl(
            params.liquidator,
            params.baseToken,
            vars.liquidationFeeToLiquidator.toInt256()
        );

        GenericLogic.requireEnoughFreeCollateral(params.clearingHouse, params.liquidator, params.baseToken);

        IVault(IClearingHouse(params.clearingHouse).getVault()).settleBadDebt(params.trader, params.baseToken);

        emit GenericLogic.PositionLiquidated(
            params.trader,
            params.baseToken,
            vars.liquidatedPositionSize.abs(),
            vars.liquidatedPositionNotional.abs(),
            vars.liquidationPenalty,
            params.liquidator,
            vars.liquidationFeeToLiquidator
        );

        // for miner amount
        rewardMinerMint(
            params.clearingHouse,
            params.trader,
            vars.liquidatedPositionNotional.abs(),
            vars.traderRealizedPnl.add(vars.liquidationPenalty.toInt256().neg256())
        );

        rewardMinerMint(
            params.clearingHouse,
            params.liquidator,
            vars.liquidatorExchangedPositionNotional.abs(),
            vars.liquidatorRealizedPnl.add(vars.liquidationFeeToLiquidator.toInt256())
        );

        return (vars.liquidatedPositionSize.abs(), vars.liquidatedPositionNotional.abs(), vars.liquidationPenalty);
    }

    //
    function swap(address clearingHouse, IVPool.SwapParams memory params) public returns (InternalSwapResponse memory) {
        IMarketRegistry.MarketInfo memory marketInfo = IMarketRegistry(
            IClearingHouse(clearingHouse).getMarketRegistry()
        ).getMarketInfo(params.baseToken);

        (uint256 scaledAmountForUniswapV3PoolSwap, int256 signedScaledAmountForReplaySwap) = PerpMath
            .calcScaledAmountForSwaps(
                params.isBaseToQuote,
                params.isExactInput,
                params.amount,
                marketInfo.uniswapFeeRatio
            );

        // simulate the swap to calculate the fees charged in exchange
        UniswapV3Broker.ReplaySwapResponse memory replayResponse = UniswapV3Broker.replaySwap(
            IMarketRegistry(IClearingHouse(clearingHouse).getMarketRegistry()).getPool(params.baseToken),
            UniswapV3Broker.ReplaySwapParams({
                baseToken: params.baseToken,
                isBaseToQuote: params.isBaseToQuote,
                shouldUpdateState: true,
                amount: signedScaledAmountForReplaySwap,
                sqrtPriceLimitX96: params.sqrtPriceLimitX96,
                uniswapFeeRatio: marketInfo.uniswapFeeRatio
            })
        );

        UniswapV3Broker.SwapResponse memory response = UniswapV3Broker.swap(
            UniswapV3Broker.SwapParams(
                marketInfo.pool,
                clearingHouse,
                params.isBaseToQuote,
                params.isExactInput,
                // mint extra base token before swap
                scaledAmountForUniswapV3PoolSwap,
                params.sqrtPriceLimitX96,
                abi.encode(
                    IVPool.SwapCallbackData({
                        trader: params.trader,
                        baseToken: params.baseToken,
                        pool: marketInfo.pool,
                        fee: replayResponse.fee,
                        uniswapFeeRatio: marketInfo.uniswapFeeRatio
                    })
                )
            )
        );

        // as we charge fees in ClearingHouse instead of in Uniswap pools,
        // we need to scale up base or quote amounts to get the exact exchanged position size and notional
        int256 exchangedPositionSize;
        int256 exchangedPositionNotional;
        if (params.isBaseToQuote) {
            // short: exchangedPositionSize <= 0 && exchangedPositionNotional >= 0
            exchangedPositionSize = PerpMath
                .calcAmountScaledByFeeRatio(response.base, marketInfo.uniswapFeeRatio, false)
                .neg256();
            // due to base to quote fee, exchangedPositionNotional contains the fee
            // s.t. we can take the fee away from exchangedPositionNotional
            exchangedPositionNotional = response.quote.toInt256();
        } else {
            // long: exchangedPositionSize >= 0 && exchangedPositionNotional <= 0
            exchangedPositionSize = response.base.toInt256();

            // scaledAmountForUniswapV3PoolSwap is the amount of quote token to swap (input),
            // response.quote is the actual amount of quote token swapped (output).
            // as long as liquidity is enough, they would be equal.
            // otherwise, response.quote < scaledAmountForUniswapV3PoolSwap
            // which also means response.quote < exact input amount.
            if (params.isExactInput && response.quote == scaledAmountForUniswapV3PoolSwap) {
                // NOTE: replayResponse.fee might have an extra charge of 1 wei, for instance:
                // Q2B exact input amount 1000000000000000000000 with fee ratio 1%,
                // replayResponse.fee is actually 10000000000000000001 (1000 * 1% + 1 wei),
                // and quote = exchangedPositionNotional - replayResponse.fee = -1000000000000000000001
                // which is not matched with exact input 1000000000000000000000
                // we modify exchangedPositionNotional here to make sure
                // quote = exchangedPositionNotional - replayResponse.fee = exact input
                exchangedPositionNotional = params.amount.sub(replayResponse.fee).toInt256().neg256();
            } else {
                exchangedPositionNotional = PerpMath
                    .calcAmountScaledByFeeRatio(response.quote, marketInfo.uniswapFeeRatio, false)
                    .neg256();
            }
        }

        // // update the timestamp of the first tx in this market
        // if (_firstTradedTimestampMap[params.baseToken] == 0) {
        //     _firstTradedTimestampMap[params.baseToken] = _blockTimestamp();
        // }

        return
            InternalSwapResponse({
                base: exchangedPositionSize,
                quote: exchangedPositionNotional.sub(replayResponse.fee.toInt256()),
                exchangedPositionSize: exchangedPositionSize,
                exchangedPositionNotional: exchangedPositionNotional,
                fee: replayResponse.fee,
                tick: replayResponse.tick
            });
    }

    function estimateSwap(
        address clearingHouse,
        DataTypes.OpenPositionParams memory params
    ) public view returns (UniswapV3Broker.ReplaySwapResponse memory response) {
        IMarketRegistry.MarketInfo memory marketInfo = IMarketRegistry(
            IClearingHouse(clearingHouse).getMarketRegistry()
        ).getMarketInfo(params.baseToken);
        uint24 uniswapFeeRatio = marketInfo.uniswapFeeRatio;
        (, int256 signedScaledAmountForReplaySwap) = PerpMath.calcScaledAmountForSwaps(
            params.isBaseToQuote,
            params.isExactInput,
            params.amount,
            uniswapFeeRatio
        );
        response = UniswapV3Broker.estimateSwap(
            IMarketRegistry(IClearingHouse(clearingHouse).getMarketRegistry()).getPool(params.baseToken),
            UniswapV3Broker.ReplaySwapParams({
                baseToken: params.baseToken,
                isBaseToQuote: params.isBaseToQuote,
                amount: signedScaledAmountForReplaySwap,
                sqrtPriceLimitX96: params.sqrtPriceLimitX96,
                uniswapFeeRatio: uniswapFeeRatio,
                shouldUpdateState: false
            })
        );
    }

    function realizedPnlTransfer(
        address clearingHouse,
        address baseToken,
        address from,
        address to,
        uint256 amount
    ) external {
        if (from != address(0) && to != address(0) && amount > 0) {
            // CHL_NEFCFT: not enough free collateral for transfer
            require(
                IVault(IClearingHouse(clearingHouse).getVault()).getFreeCollateral(from, baseToken) >= amount,
                "CHL_NEFCFT"
            );
            _modifyOwedRealizedPnl(clearingHouse, from, baseToken, amount.toInt256().neg256());
            _modifyOwedRealizedPnl(clearingHouse, to, baseToken, amount.toInt256());
            emit RealizedPnlTransfer(from, to, baseToken, amount);
        }
    }

    function repeg(address clearingHouse, address baseToken) external {
        // check isAbleRepeg
        // CH_NRP: not repeg
        require(IClearingHouse(clearingHouse).isAbleRepeg(baseToken), "CH_NRP");
        //settleFundingGlobal
        GenericLogic.settleFundingGlobal(address(this), baseToken);
        //variable
        InternalRepegVars memory repegParams;
        (repegParams.oldSqrtMarkPrice, , , , , , ) = UniswapV3Broker.getSlot0(
            IMarketRegistry(IClearingHouse(clearingHouse).getMarketRegistry()).getPool(baseToken)
        );
        repegParams.oldMarkPrice = repegParams.oldSqrtMarkPrice.formatSqrtPriceX96ToPriceX96().formatX96ToX10_18();
        repegParams.spotPrice = IVPool(IClearingHouse(clearingHouse).getVPool()).getIndexPrice(baseToken);
        repegParams.sqrtSpotPrice = repegParams.spotPrice.formatPriceX10_18ToSqrtPriceX96();

        if (repegParams.spotPrice != repegParams.oldMarkPrice) {
            // check mark price != index price over 10% and over 1 hour
            // calculate delta base (11) of long short -> delta quote (1)
            // for multiplier
            (
                repegParams.oldLongPositionSize,
                repegParams.oldShortPositionSize,
                repegParams.oldDeltaQuote
            ) = GenericLogic.getInfoMultiplier(address(this), baseToken);
            // for multiplier

            // calculate base amount for openPosition -> spot price
            // maker openPosition -> spot price
            bool isRepegUp = repegParams.spotPrice > repegParams.oldMarkPrice;
            //internal swap
            IVPool(IClearingHouse(clearingHouse).getVPool()).internalSwap(
                IVPool.SwapParams({
                    trader: msg.sender,
                    baseToken: baseToken,
                    isBaseToQuote: !isRepegUp,
                    isExactInput: true,
                    isClose: false,
                    amount: type(uint256).max.div(1e10),
                    sqrtPriceLimitX96: repegParams.sqrtSpotPrice
                })
            );
            // calculate delta quote (1) -> new delta base (22)
            // calculate scale -> new mark price => rate = (% delta price)
            // calculate scale for long short = (diff delta base on (11 - 22)) / (total_long + total_short)
            // if delta base < 0 -> decrase delta long short
            // -> if long > short -> decrease long and increase short
            // -> if long < short -> increase long and decrease short
            // if delta base > 0 -> increase delta long short
            // -> if long > short -> increase long and decrease short
            // -> if long < short -> decrease long and increase short
            // update scale for position size for long short
            (repegParams.newSqrtMarkPrice, , , , , , ) = UniswapV3Broker.getSlot0(
                IMarketRegistry(IClearingHouse(clearingHouse).getMarketRegistry()).getPool(baseToken)
            );
            repegParams.newMarkPrice = repegParams.newSqrtMarkPrice.formatSqrtPriceX96ToPriceX96().formatX96ToX10_18();
            // for multiplier
            GenericLogic.updateInfoMultiplier(
                address(this),
                baseToken,
                repegParams.oldLongPositionSize,
                repegParams.oldShortPositionSize,
                repegParams.oldDeltaQuote,
                repegParams.oldMarkPrice,
                repegParams.newMarkPrice,
                false
            );
            // for multiplier
            IVPool(IClearingHouse(clearingHouse).getVPool()).updateOverPriceSpreadTimestamp(baseToken);
            // emit event
            emit Repeg(baseToken, repegParams.oldMarkPrice, repegParams.newMarkPrice);
        }
    }
}
