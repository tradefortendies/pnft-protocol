import { MockContract, smockit } from "@eth-optimism/smock"
import { ethers } from "hardhat"
import { UniswapV3Factory, UniswapV3Pool, VirtualToken } from "../../typechain"
import { ChainlinkPriceFeedV2 } from "../../typechain"
import { NftPriceFeed } from "../../typechain"
import { isAscendingTokenOrder } from "./utilities"

interface TokensFixture {
    token0: VirtualToken
    token1: VirtualToken
}

interface PoolFixture {
    factory: UniswapV3Factory
    pool: UniswapV3Pool
    baseToken: VirtualToken
    quoteToken: VirtualToken
}

interface BaseTokenFixture {
    baseToken: VirtualToken
    mockedNFTPriceFeed: MockContract
}

interface VitrualTokenFixture {
    virtualToken: VirtualToken
}

export function createQuoteTokenFixture(name: string, symbol: string): () => Promise<VirtualToken> {
    return async (): Promise<VirtualToken> => {
        const quoteTokenFactory = await ethers.getContractFactory("VirtualToken")
        const quoteToken = (await quoteTokenFactory.deploy()) as VirtualToken
        await quoteToken.__VirtualToken_initialize(name, symbol)
        return quoteToken
    }
}

// export function createBaseTokenFixture(name: string, symbol: string): () => Promise<BaseTokenFixture> {
//     return async (): Promise<BaseTokenFixture> => {
//         const aggregatorFactory = await ethers.getContractFactory("TestAggregatorV3")
//         const aggregator = await aggregatorFactory.deploy()
//         const mockedAggregator = await smockit(aggregator)

//         mockedAggregator.smocked.decimals.will.return.with(async () => {
//             return 6
//         })

//         const chainlinkPriceFeedFactory = await ethers.getContractFactory("ChainlinkPriceFeedV2")
//         const cacheTwapInterval = 15 * 60
//         const chainlinkPriceFeed = (await chainlinkPriceFeedFactory.deploy(
//             mockedAggregator.address,
//             cacheTwapInterval,
//         )) as ChainlinkPriceFeedV2

//         const baseTokenFactory = await ethers.getContractFactory("BaseToken")
//         const baseToken = (await baseTokenFactory.deploy()) as BaseToken
//         await baseToken.initialize(name, symbol, chainlinkPriceFeed.address)

//         return { baseToken, mockedAggregator }
//     }
// }

export function createVitrualTokenFixture(name: string, symbol: string): () => Promise<VitrualTokenFixture> {
    return async (): Promise<VitrualTokenFixture> => {
        const VirtualToken = await ethers.getContractFactory("VirtualToken")
        const virtualToken = (await VirtualToken.deploy()) as VirtualToken
        await virtualToken.__VirtualToken_initialize(name, symbol)
        return { virtualToken }
    }
}

export async function uniswapV3FactoryFixture(): Promise<UniswapV3Factory> {
    const factoryFactory = await ethers.getContractFactory("UniswapV3Factory")
    return (await factoryFactory.deploy()) as UniswapV3Factory
}

// assume isAscendingTokensOrder() == true/ token0 < token1
export async function tokensFixture(): Promise<TokensFixture> {
    let token0: VirtualToken
    let token1: VirtualToken
    while (true) {
        const { virtualToken } = await createVitrualTokenFixture(
            "vBAYC",
            "vBAYC",
        )()
        if (!virtualToken.address.toLowerCase().startsWith('0xf')) {
            token0 = virtualToken
            break
        }
    }
    while (true) {
        const { virtualToken } = await createVitrualTokenFixture(
            "vETH",
            "vETH",
        )()
        if (virtualToken.address.toLowerCase().startsWith('0xf')) {
            token1 = virtualToken
            break
        }
    }
    return {
        token0,
        token1,
    }
}

export async function token0Fixture(token1Addr: string): Promise<VitrualTokenFixture> {
    let token0Fixture: VitrualTokenFixture
    while (!token0Fixture || !isAscendingTokenOrder(token0Fixture.virtualToken.address, token1Addr)) {
        token0Fixture = await createVitrualTokenFixture("RandomTestToken0", "randomToken0")()
    }
    return token0Fixture
}

export async function base0Quote1PoolFixture(): Promise<PoolFixture> {
    const { token0, token1 } = await tokensFixture()
    const factory = await uniswapV3FactoryFixture()

    const tx = await factory.createPool(token0.address, token1.address, "10000")
    const receipt = await tx.wait()
    const poolAddress = receipt.events?.[0].args?.pool as string

    const poolFactory = await ethers.getContractFactory("UniswapV3Pool")
    const pool = poolFactory.attach(poolAddress) as UniswapV3Pool

    return { factory, pool, baseToken: token0, quoteToken: token1 }
}
