import { MockContract, smockit } from "@eth-optimism/smock"
import { formatEther, parseEther, parseUnits } from "ethers/lib/utils"
import { ethers, waffle } from "hardhat"
import {
    AccountBalance,
    ClearingHouse,
    ClearingHouseConfig,
    VPool,
    InsuranceFund,
    MarketRegistry,
    RewardMiner,
    TestClearingHouse,
    TestERC20,
    TestVPool,
    LimitOrderBook,
    TestUniswapV3Broker,
    UniswapV3Factory,
    UniswapV3Pool,
    Vault,
    NFTOracle,
    VirtualToken,
} from "../../typechain"
import { ChainlinkPriceFeedV2 } from "../../typechain"
import { MockPNFTToken } from "../../typechain/MockPNFTToken"
import { TestAccountBalance } from "../../typechain/TestAccountBalance"
import { TestPNFTToken } from "../../typechain/TestPNFTToken"
import { TestRewardMiner } from "../../typechain/TestRewardMiner"
import { createQuoteTokenFixture, token0Fixture, tokensFixture, uniswapV3FactoryFixture } from "../shared/fixtures"

export interface ClearingHouseFixture {
    clearingHouse: TestClearingHouse | ClearingHouse
    accountBalance: TestAccountBalance | AccountBalance
    marketRegistry: MarketRegistry
    clearingHouseConfig: ClearingHouseConfig
    vPool: TestVPool | VPool
    vault: Vault
    insuranceFund: InsuranceFund
    uniV3Factory: UniswapV3Factory
    pool: UniswapV3Pool
    uniFeeTier: number
    WETH: TestERC20
    WBTC: TestERC20
    mockedWethPriceFeed: MockContract
    mockedWbtcPriceFeed: MockContract
    quoteToken: VirtualToken
    baseToken: VirtualToken
    baseToken2: VirtualToken
    pool2: UniswapV3Pool
    rewardMiner: RewardMiner | TestRewardMiner
    testPNFTToken: TestPNFTToken
    limitOrderBook: LimitOrderBook
    nftOracle: NFTOracle
}

export interface ClearingHouseWithDelegateApprovalFixture extends ClearingHouseFixture {
    clearingHouseOpenPositionAction: number
    clearingHouseAddLiquidityAction: number
    clearingHouseRemoveLiquidityAction: number
    notExistedAction: number
    notExistedAction2: number
}

interface UniswapV3BrokerFixture {
    uniswapV3Broker: TestUniswapV3Broker
}

export enum BaseQuoteOrdering {
    BASE_0_QUOTE_1,
    BASE_1_QUOTE_0,
}

// 1. caller of this function should ensure that (base, quote) = (token0, token1) is always true
// 2. ideally there should be no test using `canMockTime` as false as it can result in flaky test results (usually related to funding calculation)
//    but keeping this param and the comment here for notifying this issue; can see time.ts for more info
export function createClearingHouseFixture(
    canMockTime: boolean = true,
    uniFeeTier = 10000, // 1%
): () => Promise<ClearingHouseFixture> {
    return async (): Promise<ClearingHouseFixture> => {
        // deploy test tokens
        const tokenFactory = await ethers.getContractFactory("TestERC20")
        const WETH = (await tokenFactory.deploy()) as TestERC20
        await WETH.__TestERC20_init("TestWETH", "WETH", 18)
        const WBTC = (await tokenFactory.deploy()) as TestERC20
        await WBTC.__TestERC20_init("TestWBTC", "WBTC", 8)

        let UniswapV3Broker = await ethers.getContractFactory("UniswapV3Broker");
        let uniswapV3Broker = await UniswapV3Broker.deploy();

        let GenericLogic = await ethers.getContractFactory("GenericLogic", {
            libraries: {
                UniswapV3Broker: uniswapV3Broker.address,
            },
        });
        let genericLogic = await GenericLogic.deploy();
        let ClearingHouseLogic = await ethers.getContractFactory("ClearingHouseLogic", {
            libraries: {
                UniswapV3Broker: uniswapV3Broker.address,
                GenericLogic: genericLogic.address,
            },
        });
        let clearingHouseLogic = await ClearingHouseLogic.deploy();

        const wethDecimals = await WETH.decimals()

        let baseToken: VirtualToken, quoteToken: VirtualToken
        const { token0, token1 } = await tokensFixture()

        // price feed for weth and wbtc
        const aggregatorFactory = await ethers.getContractFactory("TestAggregatorV3")
        const aggregator = await aggregatorFactory.deploy()
        const chainlinkPriceFeedFactory = await ethers.getContractFactory("ChainlinkPriceFeedV2")
        const wethPriceFeed = (await chainlinkPriceFeedFactory.deploy(aggregator.address, 0)) as ChainlinkPriceFeedV2
        const mockedWethPriceFeed = await smockit(wethPriceFeed)
        const wbtcPriceFeed = (await chainlinkPriceFeedFactory.deploy(aggregator.address, 0)) as ChainlinkPriceFeedV2
        const mockedWbtcPriceFeed = await smockit(wbtcPriceFeed)
        mockedWethPriceFeed.smocked.decimals.will.return.with(8)
        mockedWbtcPriceFeed.smocked.decimals.will.return.with(8)

        // we assume (base, quote) == (token0, token1)
        baseToken = token0
        quoteToken = token1

        // deploy UniV3 factory
        const factoryFactory = await ethers.getContractFactory("UniswapV3Factory")
        const uniV3Factory = (await factoryFactory.deploy()) as UniswapV3Factory

        const clearingHouseConfigFactory = await ethers.getContractFactory("ClearingHouseConfig")
        const clearingHouseConfig = (await clearingHouseConfigFactory.deploy()) as ClearingHouseConfig
        await clearingHouseConfig.initialize()

        // prepare uniswap factory
        await uniV3Factory.createPool(baseToken.address, quoteToken.address, uniFeeTier)
        const poolFactory = await ethers.getContractFactory("UniswapV3Pool")

        const marketRegistryFactory = await ethers.getContractFactory("MarketRegistry", {
            libraries: {
                UniswapV3Broker: uniswapV3Broker.address,
            },
        })
        const marketRegistry = (await marketRegistryFactory.deploy()) as MarketRegistry
        await marketRegistry.initialize(uniV3Factory.address, quoteToken.address)

        let accountBalance
        let vPool
        if (canMockTime) {
            const accountBalanceFactory = await ethers.getContractFactory("TestAccountBalance")
            accountBalance = (await accountBalanceFactory.deploy()) as TestAccountBalance

            const vPoolFactory = await ethers.getContractFactory("TestVPool", {
                libraries: {
                    UniswapV3Broker: uniswapV3Broker.address,
                    GenericLogic: genericLogic.address,
                    ClearingHouseLogic: clearingHouseLogic.address,
                },
            })
            vPool = (await vPoolFactory.deploy()) as TestVPool
        } else {
            const accountBalanceFactory = await ethers.getContractFactory("AccountBalance")
            accountBalance = (await accountBalanceFactory.deploy()) as AccountBalance

            const vPoolFactory = await ethers.getContractFactory("VPool", {
                libraries: {
                    UniswapV3Broker: uniswapV3Broker.address,
                    GenericLogic: genericLogic.address,
                    ClearingHouseLogic: clearingHouseLogic.address,
                },
            })
            vPool = (await vPoolFactory.deploy()) as VPool
        }

        const insuranceFundFactory = await ethers.getContractFactory("InsuranceFund")
        const insuranceFund = (await insuranceFundFactory.deploy()) as InsuranceFund
        await insuranceFund.initialize(WETH.address)

        // deploy vPool
        await vPool.initialize(marketRegistry.address, clearingHouseConfig.address)
        await vPool.setAccountBalance(accountBalance.address)

        await accountBalance.initialize(clearingHouseConfig.address)

        const [admin, maker, taker, alice, a1, a2, a3, fundingFund, platformFund] = waffle.provider.getWallets()

        // deploy vault
        const vaultFactory = await ethers.getContractFactory("TestVault")
        const vault = (await vaultFactory.deploy()) as Vault
        await vault.initialize(
            insuranceFund.address,
            clearingHouseConfig.address,
            accountBalance.address,
            vPool.address,
            maker.address,
        )

        await insuranceFund.setVault(vault.address)
        await accountBalance.setVault(vault.address)

        // deploy a pool
        const poolAddr = await uniV3Factory.getPool(baseToken.address, quoteToken.address, uniFeeTier)
        const pool = poolFactory.attach(poolAddr) as UniswapV3Pool
        await baseToken.addWhitelist(pool.address)
        await quoteToken.addWhitelist(pool.address)

        // deploy another pool
        const _token0Fixture = await token0Fixture(quoteToken.address)
        const baseToken2 = _token0Fixture.virtualToken
        await uniV3Factory.createPool(baseToken2.address, quoteToken.address, uniFeeTier)
        const pool2Addr = await uniV3Factory.getPool(baseToken2.address, quoteToken.address, uniFeeTier)
        const pool2 = poolFactory.attach(pool2Addr) as UniswapV3Pool

        await baseToken2.addWhitelist(pool2.address)
        await quoteToken.addWhitelist(pool2.address)


        // deploy clearingHouse
        let clearingHouse: ClearingHouse | TestClearingHouse
        let rewardMiner: RewardMiner | TestRewardMiner
        if (canMockTime) {
            const clearingHouseFactory = await ethers.getContractFactory("TestClearingHouse", {
                libraries: {
                    UniswapV3Broker: uniswapV3Broker.address,
                    GenericLogic: genericLogic.address,
                    ClearingHouseLogic: clearingHouseLogic.address,
                },
            })
            const testClearingHouse = (await clearingHouseFactory.deploy()) as TestClearingHouse
            await testClearingHouse.__TestClearingHouse_init(
                clearingHouseConfig.address,
                vault.address,
                quoteToken.address,
                uniV3Factory.address,
                vPool.address,
                accountBalance.address,
                marketRegistry.address,
                insuranceFund.address,
                platformFund.address,
                maker.address,
            )
            clearingHouse = testClearingHouse

            const TestRewardMiner = await ethers.getContractFactory("TestRewardMiner")
            rewardMiner = (await TestRewardMiner.deploy()) as TestRewardMiner
        } else {
            const clearingHouseFactory = await ethers.getContractFactory("ClearingHouse", {
                libraries: {
                    UniswapV3Broker: uniswapV3Broker.address,
                    GenericLogic: genericLogic.address,
                    ClearingHouseLogic: clearingHouseLogic.address,
                },
            })
            clearingHouse = (await clearingHouseFactory.deploy()) as ClearingHouse
            await clearingHouse.initialize(
                clearingHouseConfig.address,
                vault.address,
                quoteToken.address,
                uniV3Factory.address,
                vPool.address,
                accountBalance.address,
                marketRegistry.address,
                insuranceFund.address,
                platformFund.address,
                maker.address,
            )
            const RewardMiner = await ethers.getContractFactory("RewardMiner")
            rewardMiner = (await RewardMiner.deploy()) as RewardMiner
        }

        await insuranceFund.setClearingHouse(clearingHouse.address)

        await clearingHouseConfig.setSettlementTokenBalanceCap(ethers.constants.MaxUint256)
        await quoteToken.mintMaximumTo(clearingHouse.address)
        await baseToken.mintMaximumTo(clearingHouse.address)
        await baseToken2.mintMaximumTo(clearingHouse.address)
        await quoteToken.addWhitelist(clearingHouse.address)
        await baseToken.addWhitelist(clearingHouse.address)
        await baseToken2.addWhitelist(clearingHouse.address)
        await marketRegistry.setClearingHouse(clearingHouse.address)
        await vPool.setClearingHouse(clearingHouse.address)
        await accountBalance.setClearingHouse(clearingHouse.address)
        await vault.setClearingHouse(clearingHouse.address)

        const TestPNFTToken = await ethers.getContractFactory("TestPNFTToken")
        const testPNFTToken = (await TestPNFTToken.deploy()) as TestPNFTToken
        await testPNFTToken.initialize('PNFT', 'PNFT')

        const limitOrderBookFactory = await ethers.getContractFactory("LimitOrderBook")
        const limitOrderBook = await limitOrderBookFactory.deploy()
        await limitOrderBook.initialize("lo", "1.0", clearingHouse.address, 1, 0)

        await clearingHouse.setDelegateApproval(limitOrderBook.address)

        // new update for open protocol
        await marketRegistry.setInsuranceFundFeeRatioGlobal(500);
        await marketRegistry.setPlatformFundFeeRatioGlobal(2000)
        await marketRegistry.setOptimalDeltaTwapRatioGlobal(30000)
        await marketRegistry.setUnhealthyDeltaTwapRatioGlobal(50000)
        await marketRegistry.setOptimalFundingRatioGlobal(250000)
        await marketRegistry.setSharePlatformFeeRatioGlobal(500000)
        await marketRegistry.setMinPoolLiquidityGlobal(parseEther('10'))
        await marketRegistry.setMaxPoolLiquidityGlobal(parseEther('1000000'))
        // max liquidity TODO

        const NFTOracle = await ethers.getContractFactory("NFTOracle")
        const nftOracle = (await NFTOracle.deploy()) as NFTOracle
        await nftOracle.initialize()
        await vPool.setNftOracle(nftOracle.address)

        // update nft address old baseToken
        // 

        await quoteToken.setMarketRegistry(marketRegistry.address)

        const VirtualToken = await ethers.getContractFactory("VirtualToken")
        const vBaseToken = (await VirtualToken.deploy()) as VirtualToken

        await marketRegistry.setVBaseToken(vBaseToken.address)

        await vault.setMarketRegistry(marketRegistry.address)
        await accountBalance.setMarketRegistry(marketRegistry.address)
        await insuranceFund.setMarketRegistry(marketRegistry.address)

        return {
            clearingHouse,
            accountBalance,
            marketRegistry,
            clearingHouseConfig,
            vPool,
            vault,
            insuranceFund,
            uniV3Factory,
            pool,
            uniFeeTier,
            WETH,
            WBTC,
            mockedWethPriceFeed,
            mockedWbtcPriceFeed,
            quoteToken,
            baseToken,
            baseToken2,
            pool2,
            rewardMiner,
            testPNFTToken,
            limitOrderBook,
            nftOracle,
        }
    }
}

export async function uniswapV3BrokerFixture(): Promise<UniswapV3BrokerFixture> {
    const factory = await uniswapV3FactoryFixture()
    const uniswapV3BrokerFactory = await ethers.getContractFactory("TestUniswapV3Broker")
    const uniswapV3Broker = (await uniswapV3BrokerFactory.deploy()) as TestUniswapV3Broker
    await uniswapV3Broker.initialize(factory.address)
    return { uniswapV3Broker }
}

export async function mockPNTTokenFixture(): Promise<MockPNFTToken> {
    const MockPNFTToken = await ethers.getContractFactory("MockPNFTToken")
    const pnftToken = (await MockPNFTToken.deploy()) as MockPNFTToken
    await pnftToken.__MockPNFTToken_init('', '', 18)
    return pnftToken
}

interface MockedClearingHouseFixture {
    clearingHouse: ClearingHouse
    clearingHouseConfig: ClearingHouseConfig
    vPool: VPool
    mockedUniV3Factory: MockContract
    mockedVault: MockContract
    mockedQuoteToken: MockContract
    mockedWETH: MockContract
    mockedBaseToken: MockContract
    mockedVPool: MockContract
    mockedInsuranceFund: MockContract
    mockedAccountBalance: MockContract
    mockedMarketRegistry: MockContract
}

export const ADDR_GREATER_THAN = true
export const ADDR_LESS_THAN = false
export async function mockedBaseTokenTo(longerThan: boolean, targetAddr: string): Promise<MockContract> {
    // deployer ensure base token is always smaller than quote in order to achieve base=token0 and quote=token1
    let mockedToken: MockContract
    while (
        !mockedToken ||
        (longerThan
            ? mockedToken.address.toLowerCase() <= targetAddr.toLowerCase()
            : mockedToken.address.toLowerCase() >= targetAddr.toLowerCase())
    ) {
        const baseTokenFactory = await ethers.getContractFactory("VirtualToken")
        const token = (await baseTokenFactory.deploy()) as VirtualToken
        await token.__VirtualToken_initialize("Test", "Test")
        mockedToken = await smockit(token)
        mockedToken.smocked.decimals.will.return.with(async () => {
            return 18
        })
    }
    return mockedToken
}

export async function mockedClearingHouseFixture(): Promise<MockedClearingHouseFixture> {
    let GenericLogic = await ethers.getContractFactory("GenericLogic");
    let genericLogic = await GenericLogic.deploy();
    let ClearingHouseLogic = await ethers.getContractFactory("ClearingHouseLogic", {
        libraries: {
            GenericLogic: genericLogic.address,
        },
    });
    let clearingHouseLogic = await ClearingHouseLogic.deploy();

    const token1 = await createQuoteTokenFixture("RandomVirtualToken", "RVT")()

    // deploy test tokens
    const tokenFactory = await ethers.getContractFactory("TestERC20")
    const WETH = (await tokenFactory.deploy()) as TestERC20
    await WETH.__TestERC20_init("TestWETH", "WETH", 18)

    const insuranceFundFactory = await ethers.getContractFactory("InsuranceFund")
    const insuranceFund = (await insuranceFundFactory.deploy()) as InsuranceFund
    const mockedInsuranceFund = await smockit(insuranceFund)

    const vaultFactory = await ethers.getContractFactory("Vault")
    const vault = (await vaultFactory.deploy()) as Vault
    const mockedVault = await smockit(vault)

    const mockedWETH = await smockit(WETH)
    const mockedQuoteToken = await smockit(token1)
    mockedQuoteToken.smocked.decimals.will.return.with(async () => {
        return 18
    })

    // deploy UniV3 factory
    const factoryFactory = await ethers.getContractFactory("UniswapV3Factory")
    const uniV3Factory = (await factoryFactory.deploy()) as UniswapV3Factory
    const mockedUniV3Factory = await smockit(uniV3Factory)

    const clearingHouseConfigFactory = await ethers.getContractFactory("ClearingHouseConfig")
    const clearingHouseConfig = (await clearingHouseConfigFactory.deploy()) as ClearingHouseConfig

    const marketRegistryFactory = await ethers.getContractFactory("MarketRegistry")
    const marketRegistry = (await marketRegistryFactory.deploy()) as MarketRegistry
    await marketRegistry.initialize(mockedUniV3Factory.address, mockedQuoteToken.address)
    const mockedMarketRegistry = await smockit(marketRegistry)
    const orderBookFactory = await ethers.getContractFactory("OrderBook")

    const vPoolFactory = await ethers.getContractFactory("VPool")
    const vPool = (await vPoolFactory.deploy()) as VPool
    await vPool.initialize(mockedMarketRegistry.address, clearingHouseConfig.address)
    const mockedVPool = await smockit(vPool)

    const accountBalanceFactory = await ethers.getContractFactory("AccountBalance")
    const accountBalance = (await accountBalanceFactory.deploy()) as AccountBalance
    const mockedAccountBalance = await smockit(accountBalance)

    // deployer ensure base token is always smaller than quote in order to achieve base=token0 and quote=token1
    const mockedBaseToken = await mockedBaseTokenTo(ADDR_LESS_THAN, mockedQuoteToken.address)

    const [admin, maker, taker, alice, a1, a2, a3, fundingFund, platformFund] = waffle.provider.getWallets()

    // deploy clearingHouse
    const clearingHouseFactory = await ethers.getContractFactory("ClearingHouse", {
        libraries: {
            ClearingHouseLogic: clearingHouseLogic.address,
        },
    })
    const clearingHouse = (await clearingHouseFactory.deploy()) as ClearingHouse
    await clearingHouse.initialize(
        clearingHouseConfig.address,
        mockedVault.address,
        mockedQuoteToken.address,
        mockedUniV3Factory.address,
        mockedVPool.address,
        mockedAccountBalance.address,
        marketRegistry.address,
        insuranceFund.address,
        platformFund.address,
        maker.address,
    )
    return {
        clearingHouse,
        clearingHouseConfig,
        vPool,
        mockedVPool,
        mockedUniV3Factory,
        mockedVault,
        mockedQuoteToken,
        mockedWETH,
        mockedBaseToken,
        mockedInsuranceFund,
        mockedAccountBalance,
        mockedMarketRegistry,
    }
}

export function createClearingHouseWithDelegateApprovalFixture(): () => Promise<ClearingHouseWithDelegateApprovalFixture> {
    return async (): Promise<ClearingHouseWithDelegateApprovalFixture> => {
        const clearingHouseFixture = await createClearingHouseFixture()()
        const clearingHouse = clearingHouseFixture.clearingHouse as TestClearingHouse

        const delegateApprovalFactory = await ethers.getContractFactory("DelegateApproval")
        const delegateApproval = await delegateApprovalFactory.deploy()
        await delegateApproval.initialize()

        const testLimitOrderBookFactory = await ethers.getContractFactory("TestLimitOrderBook")
        const testLimitOrderBook = await testLimitOrderBookFactory.deploy(clearingHouse.address)
        const testLimitOrderBook2 = await testLimitOrderBookFactory.deploy(clearingHouse.address)

        await clearingHouse.setDelegateApproval(delegateApproval.address)

        return {
            ...clearingHouseFixture,
            clearingHouseOpenPositionAction: await delegateApproval.getClearingHouseOpenPositionAction(),
            clearingHouseAddLiquidityAction: await delegateApproval.getClearingHouseAddLiquidityAction(),
            clearingHouseRemoveLiquidityAction: await delegateApproval.getClearingHouseRemoveLiquidityAction(),
            notExistedAction: 64,
            notExistedAction2: 128,
        }
    }
}
