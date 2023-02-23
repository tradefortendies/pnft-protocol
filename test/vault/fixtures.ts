import { MockContract, smockit } from "@eth-optimism/smock"
import { parseEther } from "ethers/lib/utils"
import { ethers, waffle } from "hardhat"
import {
    AccountBalance,
    ClearingHouse,
    ClearingHouseConfig,
    VPool,
    InsuranceFund,
    MarketRegistry,
    TestERC20,
    UniswapV3Factory,
    Vault,
} from "../../typechain"
import { createBaseTokenFixture } from "../shared/fixtures"

interface MockedVaultFixture {
    vault: Vault
    USDC: TestERC20
    mockedInsuranceFund: MockContract
    mockedAccountBalance: MockContract
    mockedClearingHouseConfig: MockContract
}

export async function mockedVaultFixture(): Promise<MockedVaultFixture> {
    // deploy test tokens
    const tokenFactory = await ethers.getContractFactory("TestERC20")
    const USDC = (await tokenFactory.deploy()) as TestERC20
    await USDC.__TestERC20_init("TestUSDC", "USDC", 6)

    const insuranceFundFactory = await ethers.getContractFactory("InsuranceFund")
    const insuranceFund = (await insuranceFundFactory.deploy()) as InsuranceFund
    const mockedInsuranceFund = await smockit(insuranceFund)
    mockedInsuranceFund.smocked.getToken.will.return.with(USDC.address)

    // deploy clearingHouse
    const factoryFactory = await ethers.getContractFactory("UniswapV3Factory")
    const uniV3Factory = (await factoryFactory.deploy()) as UniswapV3Factory

    const marketRegistryFactory = await ethers.getContractFactory("MarketRegistry")
    const marketRegistry = (await marketRegistryFactory.deploy()) as MarketRegistry
    await marketRegistry.initialize(uniV3Factory.address, USDC.address)

    const clearingHouseConfigFactory = await ethers.getContractFactory("ClearingHouseConfig")
    const clearingHouseConfig = (await clearingHouseConfigFactory.deploy()) as ClearingHouseConfig
    const mockedClearingHouseConfig = await smockit(clearingHouseConfig)

    const vPoolFactory = await ethers.getContractFactory("VPool")
    const vPool = (await vPoolFactory.deploy()) as VPool
    await vPool.initialize(marketRegistry.address, clearingHouseConfig.address)
    const mockedVPool = await smockit(vPool)

    const accountBalanceFactory = await ethers.getContractFactory("AccountBalance")
    const accountBalance = (await accountBalanceFactory.deploy()) as AccountBalance
    const mockedAccountBalance = await smockit(accountBalance)

    const [admin, maker, taker, alice, a1, a2, a3, fundingFund, platformFund] = waffle.provider.getWallets()

    const vaultFactory = await ethers.getContractFactory("Vault")
    const vault = (await vaultFactory.deploy()) as Vault
    await vault.initialize(
        mockedInsuranceFund.address,
        mockedClearingHouseConfig.address,
        mockedAccountBalance.address,
        mockedVPool.address,
        maker.address,
    )

    const { baseToken: quoteToken } = await createBaseTokenFixture("RandomTestToken0", "randomToken0")()
    const clearingHouseFactory = await ethers.getContractFactory("ClearingHouse")
    const clearingHouse = (await clearingHouseFactory.deploy()) as ClearingHouse
    await clearingHouse.initialize(
        clearingHouseConfig.address,
        vault.address,
        quoteToken.address,
        uniV3Factory.address,
        mockedVPool.address,
        mockedAccountBalance.address,
        marketRegistry.address,
        insuranceFund.address,
        platformFund.address,
        maker.address,
    )
    const mockedClearingHouse = await smockit(clearingHouse)

    await vault.setClearingHouse(mockedClearingHouse.address)

    return {
        vault,
        USDC,
        mockedInsuranceFund,
        mockedAccountBalance,
        mockedClearingHouseConfig,
    }
}
