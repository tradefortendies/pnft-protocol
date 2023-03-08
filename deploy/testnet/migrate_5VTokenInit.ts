import fs from "fs";

import hre, { ethers } from "hardhat";

import { encodePriceSqrt } from "../../test/shared/utilities";
import { AccountBalance, BaseToken, VPool, MarketRegistry, NftPriceFeed, QuoteToken, UniswapV3Pool, NFTOracle } from "../../typechain";
import { getMaxTickRange } from "../../test/helper/number";
import helpers from "../helpers";
import { formatEther, formatUnits, parseEther } from "ethers/lib/utils";
const { waitForTx, tryWaitForTx, loadDB, saveDB } = helpers;


async function main() {
    await deploy();
}

export default deploy;

async function deploy() {
    const network = hre.network.name;
    let deployData = (await loadDB(network))
    let priceData: PriceData;
    {
        let dataText = await fs.readFileSync(process.cwd() + '/deploy/testnet/address/prices.json')
        priceData = JSON.parse(dataText.toString())
    }
    // 

    const [admin, maker, priceAdmin, platformFund, trader, liquidator] = await ethers.getSigners()

    // deploy UniV3 factory
    var uniswapV3Factory = await hre.ethers.getContractAt('UniswapV3Factory', deployData.uniswapV3Factory.address);
    var clearingHouseConfig = await hre.ethers.getContractAt('ClearingHouseConfig', deployData.clearingHouseConfig.address);
    var marketRegistry = (await hre.ethers.getContractAt('MarketRegistry', deployData.marketRegistry.address)) as MarketRegistry;
    var accountBalance = (await hre.ethers.getContractAt('AccountBalance', deployData.accountBalance.address)) as AccountBalance;
    var vPool = (await hre.ethers.getContractAt('VPool', deployData.vPool.address)) as VPool;
    var insuranceFund = await hre.ethers.getContractAt('InsuranceFund', deployData.insuranceFund.address);
    var vault = await hre.ethers.getContractAt('Vault', deployData.vault.address);
    var clearingHouse = await hre.ethers.getContractAt('ClearingHouse', deployData.clearingHouse.address);
    var nftOracle = (await hre.ethers.getContractAt('NFTOracle', deployData.nftOracle.address)) as NFTOracle;

    const vETH = (await ethers.getContractAt('QuoteToken', deployData.vETH.address)) as QuoteToken;

    var uniFeeTier = "3000" // 0.3%

    let baseTokens = [
        deployData.vBAYC,
        deployData.vMAYC,
        deployData.vCRYPTOPUNKS,
        deployData.vMOONBIRD,
        deployData.vAZUKI,
        deployData.vCLONEX,
        deployData.vDOODLE,
    ];
    let priceKeys = [
        'priceBAYC',
        'priceMAYC',
        'priceCRYPTOPUNKS',
        'priceMOONBIRD',
        'priceAZUKI',
        'priceCLONEX',
        'priceDOODLE'
    ];
    for (let i = 0; i < 7; i++) {
        console.log(
            '--------------------------------------',
            priceKeys[i].substring(5),
            '--------------------------------------',
        )
        var baseTokenAddress = baseTokens[i].address
        var nftContractAddress = baseTokens[i].nftContract
        var initPrice = formatEther(priceData[priceKeys[i]]);

        const baseToken = (await ethers.getContractAt('BaseToken', baseTokenAddress)) as BaseToken;

        // oracle price
        {
            await waitForTx(
                await nftOracle.connect(priceAdmin).setNftPrice(nftContractAddress, parseEther(initPrice)), 'priceFeed.connect(priceAdmin).setPrice(parseEther(price))'
            )
        }
        // deploy clearingHouse
        {
            if (!(await baseToken.isInWhitelist(clearingHouse.address))) {
                await waitForTx(await baseToken.addWhitelist(clearingHouse.address),
                    'baseToken.addWhitelist(clearingHouse.address)')
            }
            if (!(await baseToken.totalSupply()).eq(ethers.constants.MaxUint256)) {
                await waitForTx(await baseToken.mintMaximumTo(clearingHouse.address),
                    'baseToken.mintMaximumTo(clearingHouse.address)')
            }
        }
        {
            // setting pool
            let poolAddr = await uniswapV3Factory.getPool(baseToken.address, vETH.address, uniFeeTier)
            if (poolAddr == ethers.constants.AddressZero) {
                await waitForTx(await uniswapV3Factory.createPool(baseToken.address, vETH.address, uniFeeTier),
                    'uniswapV3Factory.createPool(baseToken.address, vETH.address, uniFeeTier)')
            }
            poolAddr = uniswapV3Factory.getPool(baseToken.address, vETH.address, uniFeeTier)
            const uniPool = await ethers.getContractAt('UniswapV3Pool', poolAddr);
            if (!(await baseToken.isInWhitelist(uniPool.address))) {
                await waitForTx(await baseToken.addWhitelist(uniPool.address),
                    'baseToken.addWhitelist(uniPool.address)')
            }
            if (!(await vETH.isInWhitelist(uniPool.address))) {
                await waitForTx(await vETH.addWhitelist(uniPool.address),
                    'vETH.addWhitelist(uniPool.address)')
            }
            await tryWaitForTx(
                await uniPool.initialize(encodePriceSqrt(initPrice, "1")),
                'uniPool.initialize(encodePriceSqrt(price, "1"))'
            )
            // await tryWaitForTx(
            //     await uniPool.increaseObservationCardinalityNext((2 ^ 16) - 1),
            //     'uniPool.increaseObservationCardinalityNext((2 ^ 16) - 1)'
            // )
            if (!(await marketRegistry.hasPool(baseToken.address))) {
                const uniFeeRatio = await uniPool.fee()
                await tryWaitForTx(
                    await marketRegistry.addPool(nftContractAddress, baseToken.address, uniFeeRatio),
                    'marketRegistry.addPool(baseToken.address, uniFeeRatio)'
                )
            }
        }
        {
            var maxTickCrossedWithinBlock: number = 100
            if ((await vPool.getMaxTickCrossedWithinBlock(baseToken.address)).toString() != maxTickCrossedWithinBlock.toString()) {
                await tryWaitForTx(
                    await vPool.setMaxTickCrossedWithinBlock(baseToken.address, maxTickCrossedWithinBlock),
                    'vPool.setMaxTickCrossedWithinBlock(baseToken.address, maxTickCrossedWithinBlock)'
                )
            }
        }
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});