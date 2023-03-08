import fs from "fs";

import bn from "bignumber.js"

import hre, { ethers } from "hardhat";

import { encodePriceSqrt, formatSqrtPriceX96ToPrice } from "../../test/shared/utilities";
import { AccountBalance, BaseToken, ClearingHouse, ClearingHouseConfig, VPool, GenericLogic, InsuranceFund, MarketRegistry, MockPNFTToken, NftPriceFeed, QuoteToken, RewardMiner, TestERC20, TestFaucet, UniswapV3Pool, Vault, LimitOrderBook, ReferralPayment, NFTOracle, VirtualToken } from "../../typechain";
import { getMaxTickRange, priceToTick } from "../../test/helper/number";
import helpers from "../helpers";
import { formatEther, parseEther, parseUnits } from "ethers/lib/utils";
const { waitForTx, tryWaitForTx, loadDB, saveDB } = helpers;

import migrateAdmin from "./1_migrate_Admin";
import migratePriceFeedAll from "./2_migrate_PriceFeed_All";
import migrateTokens from "./3_migrate_Tokens";
import migrateQuoteToken from "./4_migrate_QuoteToken";
import migrateBaseTokenAll from "./5_migrate_BaseToken_All";
import migrateLibrary from "./6_migrate_Library";
import migrateUniswapV3 from "./6_migrate_UniswapV3";
import migrateClearingHouseConfig from "./7_migrate_ClearingHouseConfig";
import migrateMarketRegistry from "./8_migrate_MarketRegistry";
import migrateAccountBalance from "./10_migrate_AccountBalance";
import migrateVPool from "./11_migrate_VPool";
import migrateInsuranceFund from "./12_migrate_InsuranceFund";
import migrateVault from "./13_migrate_Vault";
import migrateClearingHouse from "./15_migrate_ClearingHouse";
import migratePNFTToken from "./20_migrate_PNFTToken";
import migrateRewardMiner from "./21_migrate_RewardMiner";
import migrate_ReferralPayment from "./22_migrate_ReferralPayment";
import migrate_LimitOrderBook from "./23_migrate_LimitOrderBook";
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

    // {
    //     console.log('migrateAdmin -- START --')
    //     await migrateAdmin();
    //     console.log('migrateAdmin -- END --')
    // }

    // {
    //     console.log('migratePriceFeedAll -- START --')
    //     await migratePriceFeedAll();
    //     console.log('migratePriceFeedAll -- END --')
    // }

    // // import migrateTokens from "./3_migrate_Tokens";
    // {
    //     console.log('migrateTokens -- START --')
    //     await migrateTokens();
    //     console.log('migrateTokens -- END --')
    // }

    // // import migrateQuoteToken from "./4_migrate_QuoteToken";
    // {
    //     console.log('migrateQuoteToken -- START --')
    //     await migrateQuoteToken();
    //     console.log('migrateQuoteToken -- END --')
    // }

    // // import migrateBaseTokenAll from "./5_migrate_BaseToken_All";
    // {
    //     console.log('migrateBaseTokenAll -- START --')
    //     await migrateBaseTokenAll();
    //     console.log('migrateBaseTokenAll -- END --')
    // }

    // // import migrateLibrary from "./6_migrate_Library";
    // {
    //     console.log('migrateLibrary -- START --')
    //     await migrateLibrary();
    //     console.log('migrateLibrary -- END --')
    // }

    // // import migrateUniswapV3 from "./6_migrate_UniswapV3";
    // {
    //     console.log('migrateUniswapV3 -- START --')
    //     await migrateUniswapV3();
    //     console.log('migrateUniswapV3 -- END --')
    // }

    // // import migrateClearingHouseConfig from "./7_migrate_ClearingHouseConfig";
    // {
    //     console.log('migrateClearingHouseConfig -- START --')
    //     await migrateClearingHouseConfig();
    //     console.log('migrateClearingHouseConfig -- END --')
    // }

    // // import migrateMarketRegistry from "./8_migrate_MarketRegistry";
    // {
    //     console.log('migrateMarketRegistry -- START --')
    //     await migrateMarketRegistry();
    //     console.log('migrateMarketRegistry -- END --')
    // }

    // // import migrateAccountBalance from "./10_migrate_AccountBalance";
    // {
    //     console.log('migrateAccountBalance -- START --')
    //     await migrateAccountBalance();
    //     console.log('migrateAccountBalance -- END --')
    // }

    // // import migrateVPool from "./11_migrate_VPool";
    // {
    //     console.log('migrateVPool -- START --')
    //     await migrateVPool();
    //     console.log('migrateVPool -- END --')
    // }

    // // import migrateInsuranceFund from "./12_migrate_InsuranceFund";
    // {
    //     console.log('migrateInsuranceFund -- START --')
    //     await migrateInsuranceFund();
    //     console.log('migrateInsuranceFund -- END --')
    // }

    // // import migrateVault from "./13_migrate_Vault";
    // {
    //     console.log('migrateVault -- START --')
    //     await migrateVault();
    //     console.log('migrateVault -- END --')
    // }

    // // import migrateClearingHouse from "./15_migrate_ClearingHouse";
    // {
    //     console.log('migrateClearingHouse -- START --')
    //     await migrateClearingHouse();
    //     console.log('migrateClearingHouse -- END --')
    // }

    // // import migratePNFTToken from "./20_migrate_PNFTToken";
    // {
    //     console.log('migratePNFTToken -- START --')
    //     await migratePNFTToken();
    //     console.log('migratePNFTToken -- END --')
    // }

    // // import migrateRewardMiner from "./21_migrate_RewardMiner";
    // {
    //     console.log('migrateRewardMiner -- START --')
    //     await migrateRewardMiner();
    //     console.log('migrateRewardMiner -- END --')
    // }

    // // import migrate_ReferralPayment from "./22_migrate_ReferralPayment";
    // {
    //     console.log('migrate_ReferralPayment -- START --')
    //     await migrate_ReferralPayment();
    //     console.log('migrate_ReferralPayment -- END --')
    // }

    // // import migrate_LimitOrderBook from "./23_migrate_LimitOrderBook";
    // {
    //     console.log('migrate_LimitOrderBook -- START --')
    //     await migrate_LimitOrderBook();
    //     console.log('migrate_LimitOrderBook -- END --')
    // }

    // // import migrate_NFTOracle from "./24_migrate_NFTOracle";
    // {
    //     console.log('migrate_NFTOracle -- START --')
    //     await migrate_NFTOracle();
    //     console.log('migrate_NFTOracle -- END --')
    // }

    // {
    //     console.log('migrate_VBaseToken -- START --')
    //     await migrate_VBaseToken();
    //     console.log('migrate_VBaseToken -- END --')
    // }

    // return


    const network = hre.network.name;
    let deployData = (await loadDB(network))
    let priceData: PriceData;
    {
        let dataText = await fs.readFileSync(process.cwd() + '/deploy/testnet/address/prices.json')
        priceData = JSON.parse(dataText.toString())
    }

    const [admin, maker, priceAdmin, platformFund, trader1, trader2, trader3, trader4, hieuq] = await ethers.getSigners()

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

    if ((await nftOracle.getPriceAdmin()).toLowerCase() != priceAdmin.address.toLowerCase()) {
        await waitForTx(
            await nftOracle.setPriceAdmin(priceAdmin.address),
            'nftOracle.setPriceAdmin(' + priceAdmin.address + ')'
        )
    }

    let priceKeys = [
        'priceBAYC',
        'priceMAYC',
        'priceCRYPTOPUNKS',
        'priceMOONBIRD',
        'priceAZUKI',
        'priceCLONEX',
        'priceDOODLE'
    ];
    let baseTokens = [
        deployData.vBAYC,
        deployData.vMAYC,
        deployData.vCRYPTOPUNKS,
        deployData.vMOONBIRD,
        deployData.vAZUKI,
        deployData.vCLONEX,
        deployData.vDOODLE,
    ];
    for (let i = 0; i < priceKeys.length; i++) {
        console.log(
            '--------------------------------------',
            priceKeys[i].substring(5),
            '--------------------------------------',
        )
        
        var nftContractAddress = baseTokens[i].nftContract
        var baseTokenAddress = baseTokens[i].address
        var initPrice = formatEther(priceData[priceKeys[i]]);

        if (!(await nftOracle.getNftPrice(nftContractAddress)).eq(parseEther(initPrice))) {
            await waitForTx(
                await nftOracle.connect(priceAdmin).setNftPrice(nftContractAddress, parseEther(initPrice)),
                'nftOracle.connect(priceAdmin).setNftPrice(' + nftContractAddress + ', parseEther(' + initPrice + '))'
            )
        }
        if ((await marketRegistry.getNftContract(baseTokenAddress)).toLowerCase() != nftContractAddress.toLowerCase()) {
            await waitForTx(
                await marketRegistry.setNftContract(baseTokenAddress, nftContractAddress),
                'marketRegistry.setNftContract(' + baseTokenAddress + ', ' + nftContractAddress + ')'
            )
        }
    }

    // new update for open protocol
    await waitForTx(
        await marketRegistry.setInsuranceFundFeeRatioGlobal(500),
        'marketRegistry.setInsuranceFundFeeRatioGlobal(500)'
    )
    await waitForTx(
        await marketRegistry.setPlatformFundFeeRatioGlobal(2000),
        'marketRegistry.setPlatformFundFeeRatioGlobal(2000)'
    )
    await waitForTx(
        await marketRegistry.setOptimalDeltaTwapRatioGlobal(30000),
        'marketRegistry.setOptimalDeltaTwapRatioGlobal(30000)'
    )
    await waitForTx(
        await marketRegistry.setUnhealthyDeltaTwapRatioGlobal(50000),
        'marketRegistry.setUnhealthyDeltaTwapRatioGlobal(50000)'
    )
    await waitForTx(
        await marketRegistry.setOptimalFundingRatioGlobal(250000),
        'marketRegistry.setOptimalFundingRatioGlobal(250000)'
    )
    await waitForTx(
        await marketRegistry.setSharePlatformFeeRatioGlobal(500000),
        'marketRegistry.setSharePlatformFeeRatioGlobal(500000)'
    )
    await waitForTx(
        await marketRegistry.setMinQuoteTickCrossedGlobal(parseEther('1')),
        'marketRegistry.setMinQuoteTickCrossedGlobal(parseEther(1))'
    )
    await waitForTx(
        await marketRegistry.setMaxQuoteTickCrossedGlobal(parseEther('1000000')),
        'marketRegistry.setMaxQuoteTickCrossedGlobal(parseEther(1000000))'
    )
    await waitForTx(
        await marketRegistry.setDefaultQuoteTickCrossedGlobal(parseEther('5')),
        'marketRegistry.setDefaultQuoteTickCrossedGlobal(parseEther(5))'
    )

    await waitForTx(
        await vPool.setNftOracle(nftOracle.address),
        'vPool.setNftOracle(nftOracle.address)'
    )

    await waitForTx(
        await marketRegistry.setVBaseToken(deployData.vBaseToken.address),
        'marketRegistry.setVBaseToken(deployData.vBaseToken.address)'
    )

    await waitForTx(
        await vETH.setMarketRegistry(marketRegistry.address),
        'vETH.setMarketRegistry(marketRegistry.address)'
    )

    await waitForTx(
        await vault.setMarketRegistry(marketRegistry.address),
        'vault.setMarketRegistry(marketRegistry.address)'
    )
    await waitForTx(
        await accountBalance.setMarketRegistry(marketRegistry.address),
        'accountBalance.setMarketRegistry(marketRegistry.address)'
    )
    await waitForTx(
        await insuranceFund.setMarketRegistry(marketRegistry.address),
        'insuranceFund.setMarketRegistry(marketRegistry.address)'
    )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});