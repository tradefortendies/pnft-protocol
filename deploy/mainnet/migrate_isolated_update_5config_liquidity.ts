import fs from "fs";

import bn from "bignumber.js"

import hre, { ethers } from "hardhat";

import { encodePriceSqrt, formatSqrtPriceX96ToPrice } from "../../test/shared/utilities";
import { AccountBalance, BaseToken, ClearingHouse, ClearingHouseConfig, VPool, GenericLogic, InsuranceFund, MarketRegistry, MockPNFTToken, NftPriceFeed, QuoteToken, RewardMiner, TestERC20, TestFaucet, UniswapV3Pool, Vault, LimitOrderBook, ReferralPayment, NFTOracle, VirtualToken } from "../../typechain";
import { getMaxTickRange, priceToTick } from "../../test/helper/number";
import helpers from "../helpers";
import { formatEther, parseEther, parseUnits } from "ethers/lib/utils";
const { waitForTx, tryWaitForTx, loadDB, saveDB } = helpers;

import migrateQuoteToken from "./4_migrate_QuoteToken";
import migrateBaseTokenAll from "./5_migrate_BaseToken_All";
import migrateLibrary from "./6_migrate_Library";
import migrateClearingHouseConfig from "./7_migrate_ClearingHouseConfig";
import migrateMarketRegistry from "./8_migrate_MarketRegistry";
import migrateAccountBalance from "./9_migrate_AccountBalance";
import migrateVPool from "./10_migrate_VPool";
import migrateInsuranceFund from "./11_migrate_InsuranceFund";
import migrateVault from "./12_migrate_Vault";
import migrateClearingHouse from "./13_migrate_ClearingHouse";
import migrate_NFTOracle from "./24_migrate_NFTOracle";
import migrate_VBaseToken from "./25_migrate_VBaseToken";
import { } from "../../test/helper/clearingHouseHelper";
import { BigNumber, providers } from "ethers";
import {
    signTypedData, SignTypedDataVersion, TypedMessage,
} from "@metamask/eth-sig-util";


async function main() {
    await deploy();
}

export default deploy;

async function deploy() {
    console.log('START')
    {
        console.log('migrateMarketRegistry -- START --')
        await migrateMarketRegistry();
        console.log('migrateMarketRegistry -- END --')
    }
    {
        console.log('migrateClearingHouse -- START --')
        await migrateClearingHouse();
        console.log('migrateClearingHouse -- END --')
    }
    const network = hre.network.name;
    let deployData = (await loadDB(network))
    let priceData: PriceData;
    {
        let dataText = await fs.readFileSync(process.cwd() + '/deploy/testnet/address/prices.json')
        priceData = JSON.parse(dataText.toString())
    }
    const [admin, maker, priceAdmin] = await ethers.getSigners()
    // deploy UniV3 factory
    var genericLogic = (await hre.ethers.getContractAt('GenericLogic', deployData.genericLogic.address)) as GenericLogic;
    var clearingHouseConfig = (await hre.ethers.getContractAt('ClearingHouseConfig', deployData.clearingHouseConfig.address)) as ClearingHouseConfig;
    var marketRegistry = (await hre.ethers.getContractAt('MarketRegistry', deployData.marketRegistry.address)) as MarketRegistry;
    var accountBalance = (await hre.ethers.getContractAt('AccountBalance', deployData.accountBalance.address)) as AccountBalance;
    var vPool = (await hre.ethers.getContractAt('VPool', deployData.vPool.address) as VPool);
    var insuranceFund = (await hre.ethers.getContractAt('InsuranceFund', deployData.insuranceFund.address)) as InsuranceFund;
    var vault = (await hre.ethers.getContractAt('Vault', deployData.vault.address)) as Vault;
    var clearingHouse = (await hre.ethers.getContractAt('ClearingHouse', deployData.clearingHouse.address)) as ClearingHouse;
    var rewardMiner = (await hre.ethers.getContractAt('RewardMiner', deployData.rewardMiner.address)) as RewardMiner;
    var pNFTToken = (await hre.ethers.getContractAt('MockPNFTToken', deployData.pNFTToken.address)) as MockPNFTToken;
    var testFaucet = (await hre.ethers.getContractAt('TestFaucet', deployData.testFaucet.address)) as TestFaucet;
    var wETH = (await hre.ethers.getContractAt('TestERC20', deployData.wETH.address)) as TestERC20;
    var limitOrderBook = (await hre.ethers.getContractAt('LimitOrderBook', deployData.limitOrderBook.address)) as LimitOrderBook;
    var nftOracle = (await hre.ethers.getContractAt('NFTOracle', deployData.nftOracle.address)) as NFTOracle;
    const vETH = (await ethers.getContractAt('QuoteToken', deployData.vETH.address)) as QuoteToken;

    let baseTokens = [
        '0x0929839cD4210627840b32f3541E531b868e93cF',
        '0x42Aa7d1c68d54527779Fa19f5412694528a16330',
        '0x892b3F3e0443C8004DfAfdB1149709aBfb09e9C2',
        '0x533A0D65Bc3e3370b521B2A02e66279F70d7BCD5',
        '0xbC39bCb25002F77BBacE7be154eeed625EBA3509',
        '0x1E203de9dAC47F1f0FdAcA23C2b05b9Ac8653754',
        '0x6C8Df56656E6C870b5a90C630CcA599C9c38EE02',
        '0xe1AC6993DFfF43350e7d8FB3F31D7701D4f8e59a',
        '0xAc47ED625286835712B66e2FdBBc56807a583b05',

    ];
    let initLiquidities = [
        parseEther('136.99'),
        parseEther('524.30'),
        parseEther('257.47'),
        parseEther('194.52'),
        parseEther('288.44'),
        parseEther('227.25'),
        parseEther('134.35'),
        parseEther('516.01'),
        parseEther('523.47'),
    ];

    for (let i = 0; i < baseTokens.length; i++) {
        var baseTokenAddress = baseTokens[i]
        var initLiquidity = initLiquidities[i]

        console.log(
            '--------------------------------------',
            baseTokenAddress,
            '--------------------------------------',
        )

        const baseToken = await hre.ethers.getContractAt('BaseToken', baseTokenAddress);
        let liquidity = await clearingHouse.getLiquidity(baseToken.address)
        if (initLiquidity.gt(liquidity)) {
            await waitForTx(
                await clearingHouse.connect(maker).addLiquidity({
                    baseToken: baseToken.address,
                    liquidity: initLiquidity.sub(liquidity),
                    deadline: ethers.constants.MaxUint256,
                }),
                'clearingHouse.connect(maker).addLiquidity'
            )
        } else if (initLiquidity.lt(liquidity)) {
            await waitForTx(
                await clearingHouse.connect(maker).removeLiquidity({
                    baseToken: baseToken.address,
                    liquidity: liquidity.sub(initLiquidity),
                    deadline: ethers.constants.MaxUint256,
                }),
                'clearingHouse.connect(maker).removeLiquidity'
            )
        }
    }

    console.log('END')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});