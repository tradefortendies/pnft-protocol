import { MockContract } from "@eth-optimism/smock"
import { formatEther, parseEther, parseUnits } from "ethers/lib/utils"
import { ethers, waffle } from "hardhat"
import { format } from "path"
import {
    ClearingHouseConfig, InsuranceFund,
    MarketRegistry,
    NFTOracle,
    TestAccountBalance,
    TestClearingHouse,
    TestERC20,
    TestRewardMiner,
    UniswapV3Pool,
    Vault, VirtualToken, VPool
} from "../../typechain"
import { initMarket } from "../helper/marketHelper"
import { getMaxTickRange } from "../helper/number"
import { deposit } from "../helper/token"
import { forwardBothTimestamps } from "../shared/time"
import { encodePriceSqrt } from "../shared/utilities"
import { ClearingHouseFixture, createClearingHouseFixture } from "./fixtures"

describe("ClearingHouse check bayc", () => {

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
    let baseToken: VirtualToken
    let quoteToken: VirtualToken
    let pool: UniswapV3Pool
    let nftOracle: NFTOracle
    let collateralDecimals: number
    let rewardMiner: TestRewardMiner
    const initPrice = "63.86"

    beforeEach(async () => {
        fixture = await loadFixture(createClearingHouseFixture())
        clearingHouse = fixture.clearingHouse as TestClearingHouse
        clearingHouseConfig = fixture.clearingHouseConfig as ClearingHouseConfig
        accountBalance = fixture.accountBalance as TestAccountBalance
        vault = fixture.vault as Vault
        insuranceFund = fixture.insuranceFund as InsuranceFund
        vPool = fixture.vPool as VPool
        marketRegistry = fixture.marketRegistry
        pool = fixture.pool as UniswapV3Pool
        collateral = fixture.WETH
        baseToken = fixture.baseToken
        quoteToken = fixture.quoteToken
        nftOracle = fixture.nftOracle
        collateralDecimals = await collateral.decimals()
        rewardMiner = fixture.rewardMiner as TestRewardMiner

        await initMarket(fixture, initPrice, undefined, 0)

        await nftOracle.setNftPrice((await marketRegistry.getNftContract(baseToken.address)), parseUnits(initPrice, 18))

        // prepare collateral for trader
        await collateral.mint(trader1.address, parseUnits("1000000", collateralDecimals))
        await deposit(trader1, vault, 1000000, collateral, baseToken)

        await collateral.mint(trader2.address, parseUnits("1000000", collateralDecimals))
        await deposit(trader2, vault, 1000000, collateral, baseToken)
    })

    it("check bayc", async () => {
        await vPool.setMaxTickCrossedWithinBlock(getMaxTickRange())
        
        await marketRegistry.setMinQuoteTickCrossedGlobal(parseEther('0.00000001'))

        // maker add liquidity
        await clearingHouse.connect(maker).addLiquidity({
            baseToken: baseToken.address,
            liquidity: parseEther('120.93'),
            deadline: ethers.constants.MaxUint256,
        })
        {
            await clearingHouse.connect(trader1).openPosition({
                baseToken: baseToken.address,
                isBaseToQuote: true,
                isExactInput: true,
                oppositeAmountBound: 0,
                amount: parseEther('0.505'),
                sqrtPriceLimitX96: 0,
                deadline: ethers.constants.MaxUint256,
                referralCode: ethers.constants.HashZero,
            })
        }
        {
            await clearingHouse.connect(trader2).openPosition({
                baseToken: baseToken.address,
                isBaseToQuote: false,
                isExactInput: false,
                oppositeAmountBound: 0,
                amount: parseEther('0.0005'),
                sqrtPriceLimitX96: 0,
                deadline: ethers.constants.MaxUint256,
                referralCode: ethers.constants.HashZero,
            })
        }
        let markPrice = formatEther(await vPool.getMarkPrice(baseToken.address))
        console.log(
            'getMarkPrice',
            markPrice,
        )
        await clearingHouse.connect(trader1).closePosition({
            baseToken: baseToken.address,
            sqrtPriceLimitX96: parseEther("0"),
            oppositeAmountBound: parseEther("0"),
            deadline: ethers.constants.MaxUint256,
            referralCode: ethers.constants.HashZero,
        })
        await clearingHouse.connect(maker).removeLiquidity({
            baseToken: baseToken.address,
            liquidity: parseEther('119'),
            deadline: ethers.constants.MaxUint256,
        })
        console.log(
            'baseToken.balanceOf',
            formatEther(await baseToken.balanceOf(await marketRegistry.getPool(baseToken.address)))
        )
        {
            await clearingHouse.connect(trader1).openPosition({
                baseToken: baseToken.address,
                isBaseToQuote: true,
                isExactInput: true,
                oppositeAmountBound: 0,
                amount: ethers.constants.MaxUint256.div(1e10),
                sqrtPriceLimitX96: encodePriceSqrt(markPrice, '1'),
                deadline: ethers.constants.MaxUint256,
                referralCode: ethers.constants.HashZero,
            })
        }

        markPrice = formatEther(await vPool.getMarkPrice(baseToken.address))
        console.log(
            'getMarkPrice',
            markPrice,
        )

        console.log(
            'getTotalPositionSize',
            formatEther(await accountBalance.getTotalPositionSize(trader1.address, baseToken.address)),
        )        

        await clearingHouse.connect(maker).addLiquidity({
            baseToken: baseToken.address,
            liquidity: parseEther('119'),
            deadline: ethers.constants.MaxUint256,
        })

    })
})

// (242449207688640717-138602831200387017) / 1e18

// (-30060640221859737+22000000000000000)/1e18*5