import { MockContract } from "@eth-optimism/smock"
import { formatEther, parseEther, parseUnits } from "ethers/lib/utils"
import { ethers, waffle } from "hardhat"
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
import { findPoolAddedEvents } from "../helper/clearingHouseHelper"
import { initMarket } from "../helper/marketHelper"
import { getMaxTickRange } from "../helper/number"
import { deposit } from "../helper/token"
import { forwardBothTimestamps } from "../shared/time"
import { encodePriceSqrt } from "../shared/utilities"
import { ClearingHouseFixture, createClearingHouseFixture } from "./fixtures"

describe("ClearingHouse openProtocol", () => {

    const [admin, maker, trader1, trader2, liquidator, priceAdmin, creator, contributor, platformFund] = waffle.provider.getWallets()
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
    const initPrice = "1"

    let nftAddress: string;

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
        nftOracle = fixture.nftOracle
        collateralDecimals = await collateral.decimals()
        rewardMiner = fixture.rewardMiner as TestRewardMiner

        await initMarket(fixture, initPrice, undefined, 0)

        nftAddress = ethers.Wallet.createRandom().address
        console.log('nftAddress', nftAddress)

        // open baseToken
        {

            let r = await (
                await marketRegistry.connect(creator).createIsolatedPool(nftAddress, 'TEST', encodePriceSqrt(initPrice, "1"))
            ).wait()

            let log = await findPoolAddedEvents(marketRegistry, r)[0]
            console.log(
                'baseToken',
                (log.args.baseToken),
            )

            baseToken = (await ethers.getContractAt('VirtualToken', log.args.baseToken)) as VirtualToken;
        }

        await marketRegistry.setNftContract(baseToken.address, nftAddress)

        // prepare collateral for trader
        // await collateral.mint(trader1.address, parseUnits("1000000", collateralDecimals))
        // await deposit(trader1, vault, 1000000, collateral, baseToken)

        // await collateral.mint(trader2.address, parseUnits("1000000", collateralDecimals))
        // await deposit(trader2, vault, 1000000, collateral, baseToken)

        // await collateral.mint(liquidator.address, parseUnits("1000000", collateralDecimals))
        // await deposit(liquidator, vault, 1000000, collateral, baseToken)

        await collateral.mint(trader1.address, parseUnits("1000000", collateralDecimals))
        await collateral.mint(contributor.address, parseUnits("1000000", collateralDecimals))

        await collateral.connect(trader1).approve(vault.address, parseUnits("1000000", collateralDecimals))
        await collateral.connect(contributor).approve(vault.address, parseUnits("1000000", collateralDecimals))

        await vPool.setMaxTickCrossedWithinBlock(getMaxTickRange())

        await nftOracle.setNftPrice(nftAddress, parseUnits(initPrice, 18))
    })

    it("isolated check", async () => {
        await forwardBothTimestamps(clearingHouse, 86400)

        await clearingHouseConfig.setDurationRepegOverPriceSpread(0)

        // // maker add liquidity
        // await clearingHouse.connect(creator).addLiquidity({
        //     baseToken: baseToken.address,
        //     liquidity: parseEther('1000'),
        //     deadline: ethers.constants.MaxUint256,
        // })

        var isBaseToQuote: boolean
        isBaseToQuote = true
        {
            await clearingHouse.connect(trader1).depositAndOpenPosition({
                baseToken: baseToken.address,
                isBaseToQuote: isBaseToQuote,
                isExactInput: !isBaseToQuote,
                oppositeAmountBound: 0,
                amount: parseEther('10'),
                sqrtPriceLimitX96: 0,
                deadline: ethers.constants.MaxUint256,
                referralCode: ethers.constants.HashZero,
            },
                collateral.address,
                parseUnits("3", collateralDecimals),
            )
        }
        await clearingHouse.connect(trader1).closePosition(
            {
                baseToken: baseToken.address,
                sqrtPriceLimitX96: parseEther("0"),
                oppositeAmountBound: parseEther("0"),
                deadline: ethers.constants.MaxUint256,
                referralCode: ethers.constants.HashZero,
            }
        )

        await insuranceFund.connect(contributor).contribute(baseToken.address, collateral.address, parseEther('1'))

        {
            await clearingHouse.connect(trader1).depositAndOpenPosition({
                baseToken: baseToken.address,
                isBaseToQuote: isBaseToQuote,
                isExactInput: !isBaseToQuote,
                oppositeAmountBound: 0,
                amount: parseEther('10'),
                sqrtPriceLimitX96: 0,
                deadline: ethers.constants.MaxUint256,
                referralCode: ethers.constants.HashZero,
            },
                collateral.address,
                parseUnits("3", collateralDecimals),
            )
        }
        await clearingHouse.connect(trader1).closePosition(
            {
                baseToken: baseToken.address,
                sqrtPriceLimitX96: parseEther("0"),
                oppositeAmountBound: parseEther("0"),
                deadline: ethers.constants.MaxUint256,
                referralCode: ethers.constants.HashZero,
            }
        )

        let owedRealizedPnlTrade1 = (await accountBalance.getPnlAndPendingFee(trader1.address, baseToken.address))[0]
        let owedRealizedPnlPlatformFund = (await accountBalance.getPnlAndPendingFee(platformFund.address, ethers.constants.AddressZero))[0]
        let owedRealizedPnlInsuranceFund = (await accountBalance.getPnlAndPendingFee(insuranceFund.address, baseToken.address))[0]
        let owedRealizedPnlCreator = (await accountBalance.getPnlAndPendingFee(creator.address, baseToken.address))[0]

        console.log(
            'owedRealizedPnl',
            formatEther(owedRealizedPnlTrade1),
            formatEther(owedRealizedPnlPlatformFund),
            formatEther(owedRealizedPnlInsuranceFund),
            formatEther(owedRealizedPnlCreator),
            formatEther(owedRealizedPnlPlatformFund.add(owedRealizedPnlInsuranceFund).add(owedRealizedPnlTrade1).add(owedRealizedPnlCreator)),
        )
        {
            let [insuranceBalance, sharedFee, pendingFee] = (await insuranceFund.getAvailableFund(baseToken.address, creator.address))
            console.log(
                'creator-getAvailableFund',
                formatEther(insuranceBalance),
                formatEther(sharedFee),
                formatEther(pendingFee),
            )
        }
        {
            let [insuranceBalance, sharedFee, pendingFee] = (await insuranceFund.getAvailableFund(baseToken.address, contributor.address))
            console.log(
                'contributor-getAvailableFund',
                formatEther(insuranceBalance),
                formatEther(sharedFee),
                formatEther(pendingFee),
            )
        }
        {
            let [insuranceBalance, sharedFee, pendingFee] = (await insuranceFund.getAvailableFund(baseToken.address, insuranceFund.address))
            console.log(
                'insuranceFund-getAvailableFund',
                formatEther(insuranceBalance),
                formatEther(sharedFee),
                formatEther(pendingFee),
            )
        }
        console.log('---spendFund---0.01')

        await accountBalance.testModifyOwedRealizedPnl(insuranceFund.address, parseEther('-0.1'), baseToken.address)

        {
            let [insuranceBalance, sharedFee, pendingFee] = (await insuranceFund.getAvailableFund(baseToken.address, creator.address))
            console.log(
                'creator-getAvailableFund',
                formatEther(insuranceBalance),
                formatEther(sharedFee),
                formatEther(pendingFee),
            )
        }
        {
            let [insuranceBalance, sharedFee, pendingFee] = (await insuranceFund.getAvailableFund(baseToken.address, contributor.address))
            console.log(
                'contributor-getAvailableFund',
                formatEther(insuranceBalance),
                formatEther(sharedFee),
                formatEther(pendingFee),
            )
        }
        {
            let [insuranceBalance, sharedFee, pendingFee] = (await insuranceFund.getAvailableFund(baseToken.address, insuranceFund.address))
            console.log(
                'insuranceFund-getAvailableFund',
                formatEther(insuranceBalance),
                formatEther(sharedFee),
                formatEther(pendingFee),
            )
        }

    })
})