import fs from "fs";

import bn from "bignumber.js"

import hre, { ethers } from "hardhat";

import { encodePriceSqrt, formatSqrtPriceX96ToPrice } from "../../test/shared/utilities";
import { AccountBalance, BaseToken, ClearingHouse, ClearingHouseConfig, VPool, GenericLogic, InsuranceFund, MarketRegistry, MockPNFTToken, NftPriceFeed, QuoteToken, RewardMiner, TestERC20, TestFaucet, UniswapV3Pool, Vault, LimitOrderBook, ReferralPayment, NFTOracle, VirtualToken } from "../../typechain";
import { getMaxTickRange, priceToTick } from "../../test/helper/number";
import helpers from "../helpers";
import { formatEther, parseEther, parseUnits } from "ethers/lib/utils";
const { waitForTx, tryWaitForTx, loadDB, saveDB } = helpers;

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

    if ((await nftOracle.getPriceAdmin()).toLowerCase() != priceAdmin.address.toLowerCase()) {
        await waitForTx(
            await nftOracle.setPriceAdmin(priceAdmin.address),
            'nftOracle.setPriceAdmin(' + priceAdmin.address + ')'
        )
    }
    let priceKeys = [
        'priceBAYC',
        'priceCRYPTOPUNKS',
        'priceAZUKI',
    ];
    let baseTokens = [
        deployData.vBAYC,
        deployData.vCRYPTOPUNKS,
        deployData.vAZUKI,
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
        if ((await marketRegistry.isOpen(baseTokenAddress)) != true) {
            await waitForTx(
                await marketRegistry.setIsOpen(baseTokenAddress, true),
                'marketRegistry.setIsOpen(' + baseTokenAddress + ', true)'
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
        await marketRegistry.setMaxQuoteTickCrossedGlobal(parseEther('1000')),
        'marketRegistry.setMaxQuoteTickCrossedGlobal(parseEther(1000))'
    )
    await waitForTx(
        await marketRegistry.setDefaultQuoteTickCrossedGlobal(parseEther('5')),
        'marketRegistry.setDefaultQuoteTickCrossedGlobal(parseEther(5))'
    )
    await waitForTx(
        await marketRegistry.setMinQuoteTickCrossedGlobal(parseEther('1')),
        'marketRegistry.setMinQuoteTickCrossedGlobal(parseEther(1))'
    )
    await waitForTx(
        await marketRegistry.setMinInsuranceFundPerContribution(parseEther('0.1')),
        'marketRegistry.setMinInsuranceFundPerContribution(parseEther(0.1))'
    )
    await waitForTx(
        await marketRegistry.setMinInsuranceFundPerCreated(parseEther('0.01')),
        'marketRegistry.setMinInsuranceFundPerCreated(parseEther(0.01))'
    )
    await waitForTx(
        await marketRegistry.setInsuranceFund(insuranceFund.address),
        'marketRegistry.setInsuranceFund(insuranceFund.address)'
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
    var maxTickCrossedWithinBlock: number = 200
    if ((await vPool.getMaxTickCrossedWithinBlock()).toString() != maxTickCrossedWithinBlock.toString()) {
        await tryWaitForTx(
            await vPool.setMaxTickCrossedWithinBlock(maxTickCrossedWithinBlock),
            'vPool.setMaxTickCrossedWithinBlock(maxTickCrossedWithinBlock)'
        )
    }
    await waitForTx(
        await marketRegistry.setVBaseToken(deployData.vBaseToken.address),
        'marketRegistry.setVBaseToken(deployData.vBaseToken.address)'
    )
    await waitForTx(
        await vPool.setNftOracle(nftOracle.address),
        'vPool.setNftOracle(nftOracle.address)'
    )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});