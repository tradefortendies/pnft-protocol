import { MockContract } from "@eth-optimism/smock"
import { parseEther, parseUnits } from "ethers/lib/utils"
import { ethers, waffle } from "hardhat"
import {
    BaseToken,
    ClearingHouseConfig, InsuranceFund, LimitOrderBook, MarketRegistry,
    QuoteToken,
    TestAccountBalance,
    TestClearingHouse,
    TestERC20,
    TestRewardMiner,
    UniswapV3Pool,
    Vault, VPool
} from "../../typechain"
import { initMarket } from "../helper/marketHelper"
import { deposit } from "../helper/token"
import { forwardBothTimestamps } from "../shared/time"
import { ClearingHouseFixture, createClearingHouseFixture } from "./fixtures"

describe("ClearingHouse random trade liquidity repeg close", () => {

    const [admin, maker, trader1, trader2, liquidator, priceAdmin, user01, fundingFund, platformFund] = waffle.provider.getWallets()
    const loadFixture: ReturnType<typeof waffle.createFixtureLoader> = waffle.createFixtureLoader([admin])
    let fixture: ClearingHouseFixture
    let clearingHouse: TestClearingHouse
    let clearingHouseConfig: ClearingHouseConfig
    let marketRegistry: MarketRegistry
    let accountBalance: TestAccountBalance
    let vault: Vault
    let insuranceFund: InsuranceFund
    let vPool: VPool
    let collateral: TestERC20
    let baseToken: BaseToken
    let quoteToken: QuoteToken
    let pool: UniswapV3Pool
    let mockedNFTPriceFeed: MockContract
    let collateralDecimals: number
    let rewardMiner: TestRewardMiner
    let limitOrderBook: LimitOrderBook
    const initPrice = "1"

    beforeEach(async () => {
        fixture = await loadFixture(createClearingHouseFixture())
        clearingHouse = fixture.clearingHouse as TestClearingHouse
        clearingHouseConfig = fixture.clearingHouseConfig as ClearingHouseConfig
        accountBalance = fixture.accountBalance as TestAccountBalance
        vault = fixture.vault
        insuranceFund = fixture.insuranceFund as InsuranceFund
        vPool = fixture.vPool as VPool
        marketRegistry = fixture.marketRegistry
        pool = fixture.pool as UniswapV3Pool
        collateral = fixture.WETH
        baseToken = fixture.baseToken
        quoteToken = fixture.quoteToken
        mockedNFTPriceFeed = fixture.mockedNFTPriceFeed
        collateralDecimals = await collateral.decimals()
        rewardMiner = fixture.rewardMiner as TestRewardMiner
        limitOrderBook = fixture.limitOrderBook

        await initMarket(fixture, initPrice, undefined, 0)
        mockedNFTPriceFeed.smocked.getPrice.will.return.with(async () => {
            return parseUnits(initPrice, 18)
        })

        // prepare collateral for trader
        await collateral.mint(trader1.address, parseUnits("1000000", collateralDecimals))
        await deposit(trader1, vault, 1000000, collateral)

        await collateral.mint(trader2.address, parseUnits("1000000", collateralDecimals))
        await deposit(trader2, vault, 1000000, collateral)

        await collateral.mint(liquidator.address, parseUnits("1000000", collateralDecimals))
        await deposit(liquidator, vault, 1000000, collateral)
    })

    it("random check", async () => {
        await forwardBothTimestamps(clearingHouse, 86400)

        // maker add liquidity
        await clearingHouse.connect(maker).addLiquidity({
            baseToken: baseToken.address,
            liquidity: parseEther('1000'),
            deadline: ethers.constants.MaxUint256,
        })

        let fillOrderParams = {
            multiplier: '0',
            orderType: '0',
            nonce: '0',
            trader: trader1.address,
            baseToken: baseToken.address,
            isBaseToQuote: false,
            isExactInput: true,
            amount: parseEther('10').toString(),
            oppositeAmountBound: parseUnits('0', 0).toString(),
            deadline: ethers.constants.MaxUint256.toString(),
            triggerPrice: parseUnits(initPrice, 18).toString(),
            takeProfitPrice: parseUnits("1.01", 18).toString(),
            stopLossPrice: parseUnits("0.99", 18).toString(),
        }

        const { chainId } = await ethers.provider.getNetwork()

        const typedData = {
            types: {
                EIP712Domain: [
                    { name: "name", type: "string" },
                    { name: "version", type: "string" },
                    { name: "chainId", type: "uint256" },
                    { name: "verifyingContract", type: "address" },
                ],
                LimitOrderParams: [
                    { name: "multiplier", type: "uint256" },
                    { name: "orderType", type: "uint8" },
                    { name: "nonce", type: "uint256" },
                    { name: "trader", type: "address" },
                    { name: "baseToken", type: "address" },
                    { name: "isBaseToQuote", type: "bool" },
                    { name: "isExactInput", type: "bool" },
                    { name: "amount", type: "uint256" },
                    { name: "oppositeAmountBound", type: "uint256" },
                    { name: "deadline", type: "uint256" },
                    { name: "triggerPrice", type: "uint256" },
                    { name: "takeProfitPrice", type: "uint256" },
                    { name: "stopLossPrice", type: "uint256" },
                ]
            },
            primaryType: "LimitOrderParams",
            domain: {
                name: "lo",
                version: "1.0",
                chainId: chainId,
                verifyingContract: limitOrderBook.address,
            },
            message: fillOrderParams
        };

        const signature = await ethers.provider.send("eth_signTypedData_v4", [
            trader1.address,
            JSON.stringify(typedData)
        ]);


        await limitOrderBook.connect(liquidator).fillLimitOrder(fillOrderParams, ethers.utils.arrayify(signature))

        //take profit || stoploss

        await limitOrderBook.connect(liquidator).closeLimitOrder(fillOrderParams)

        // await limitOrderBook.connect(trader1).cancelLimitOrder({
        //     multiplier: 0,
        //     orderType: 0,
        //     nonce: 0,
        //     trader: trader1.address,
        //     baseToken: baseToken.address,
        //     isBaseToQuote: false,
        //     isExactInput: true,
        //     amount: parseEther('10'),
        //     oppositeAmountBound: 0,
        //     deadline: ethers.constants.MaxUint256,
        //     triggerPrice: parseUnits(initPrice, 18),
        //     takeProfitPrice: parseUnits(initPrice, 18),
        //     stopLossPrice: parseUnits(initPrice, 18),
        // })

    })


})