import fs from "fs";

import hre, { ethers } from "hardhat";

import { encodePriceSqrt } from "../../test/shared/utilities";
import { AccountBalance, BaseToken, ClearingHouse, ClearingHouseConfig, VPool, InsuranceFund, MarketRegistry, NftPriceFeed, QuoteToken, RewardMiner, UniswapV3Pool, Vault, LimitOrderBook, NFTOracle } from "../../typechain";
import { getMaxTickRange } from "../../test/helper/number";
import helpers from "../helpers";
import { parseEther } from "ethers/lib/utils";
const { waitForTx, tryWaitForTx, loadDB, saveDB } = helpers;


async function main() {
    await deploy();
}

export default deploy;

async function deploy() {
    const network = hre.network.name;
    let deployData = (await loadDB(network))
    // 

    const [admin, maker, priceAdmin, platformFund, trader, liquidator] = await ethers.getSigners()

    // deploy UniV3 factory
    var uniswapV3Factory = await hre.ethers.getContractAt('UniswapV3Factory', deployData.uniswapV3Factory.address);
    var clearingHouseConfig = (await hre.ethers.getContractAt('ClearingHouseConfig', deployData.clearingHouseConfig.address)) as ClearingHouseConfig;
    var marketRegistry = (await hre.ethers.getContractAt('MarketRegistry', deployData.marketRegistry.address)) as MarketRegistry;
    var accountBalance = (await hre.ethers.getContractAt('AccountBalance', deployData.accountBalance.address)) as AccountBalance;
    var vPool = (await hre.ethers.getContractAt('VPool', deployData.vPool.address) as VPool);
    var insuranceFund = (await hre.ethers.getContractAt('InsuranceFund', deployData.insuranceFund.address)) as InsuranceFund;
    var vault = (await hre.ethers.getContractAt('Vault', deployData.vault.address)) as Vault;
    var clearingHouse = (await hre.ethers.getContractAt('ClearingHouse', deployData.clearingHouse.address)) as ClearingHouse;
    var rewardMiner = (await hre.ethers.getContractAt('RewardMiner', deployData.rewardMiner.address)) as RewardMiner;
    var limitOrderBook = (await hre.ethers.getContractAt('LimitOrderBook', deployData.limitOrderBook.address)) as LimitOrderBook;
    var nftOracle = (await hre.ethers.getContractAt('NFTOracle', deployData.nftOracle.address)) as NFTOracle;

    const vETH = (await ethers.getContractAt('QuoteToken', deployData.vETH.address)) as QuoteToken;

    if ((await vPool.getAccountBalance()).toLowerCase() != accountBalance.address.toLowerCase()) {
        await waitForTx(await vPool.setAccountBalance(accountBalance.address), 'vPool.setAccountBalance(accountBalance.address)')
    }
    if ((await insuranceFund.getVault()).toLowerCase() != vault.address.toLowerCase()) {
        await waitForTx(await insuranceFund.setVault(vault.address), 'insuranceFund.setVault(vault.address)')
    }
    if ((await accountBalance.getVault()).toLowerCase() != vault.address.toLowerCase()) {
        await waitForTx(await accountBalance.setVault(vault.address), 'accountBalance.setVault(vault.address)')
    }
    if ((await marketRegistry.getClearingHouse()).toLowerCase() != clearingHouse.address.toLowerCase()) {
        await waitForTx(await marketRegistry.setClearingHouse(clearingHouse.address), 'marketRegistry.setClearingHouse(clearingHouse.address)')
    }
    if ((await vPool.getClearingHouse()).toLowerCase() != clearingHouse.address.toLowerCase()) {
        await waitForTx(await vPool.setClearingHouse(clearingHouse.address), 'vPool.setClearingHouse(clearingHouse.address)')
    }
    if ((await accountBalance.getClearingHouse()).toLowerCase() != clearingHouse.address.toLowerCase()) {
        await waitForTx(await accountBalance.setClearingHouse(clearingHouse.address), 'accountBalance.setClearingHouse(clearingHouse.address)')
    }
    if ((await vault.getClearingHouse()).toLowerCase() != clearingHouse.address.toLowerCase()) {
        await waitForTx(await vault.setClearingHouse(clearingHouse.address), 'vault.setClearingHouse(clearingHouse.address)')
    }
    if (network == 'arbitrum' || network == 'arbitrumGoerli' || network == 'arbitrumDev' || network == 'local') {
        if ((await vault.getWETH9()).toLowerCase() != deployData.wETH.address.toLowerCase()) {
            await waitForTx(await vault.setWETH9(deployData.wETH.address), 'vault.setWETH9(deployData.wETH.address)')
        }
    }
    // deploy clearingHouse
    if (!(await vETH.isInWhitelist(clearingHouse.address))) {
        await waitForTx(await vETH.addWhitelist(clearingHouse.address), 'vETH.addWhitelist(clearingHouse.address)')
    }
    if (!(await vETH.totalSupply()).eq(ethers.constants.MaxUint256)) {
        await waitForTx(await vETH.mintMaximumTo(clearingHouse.address), 'vETH.mintMaximumTo(clearingHouse.address)')
    }
    if ((await clearingHouse.getPlatformFund()).toLowerCase() != deployData.platformFundAddress.toLowerCase()) {
        await waitForTx(
            await clearingHouse.setPlatformFund(deployData.platformFundAddress), 'clearingHouse.setPlatformFund(deployData.platformFundAddress)'
        )
    }
    if ((await clearingHouse.getRewardMiner()).toLowerCase() != rewardMiner.address.toLowerCase()) {
        await waitForTx(
            await clearingHouse.setRewardMiner(rewardMiner.address), 'clearingHouse.setRewardMiner(rewardMiner.address)'
        )
    }
    if (!(await clearingHouseConfig.getSettlementTokenBalanceCap()).eq(ethers.constants.MaxUint256)) {
        await waitForTx(
            await clearingHouseConfig.setSettlementTokenBalanceCap(ethers.constants.MaxUint256), 'clearingHouseConfig.setSettlementTokenBalanceCap(ethers.constants.MaxUint256)'
        )
    }
    if ((await clearingHouseConfig.getImRatio()).toString() != '200000') {
        await waitForTx(
            await clearingHouseConfig.setImRatio('200000'), 'await clearingHouseConfig.setImRatio(200000)'
        )
    }
    var durationRepegOverPriceSpread = '28800';
    if ((await clearingHouseConfig.getDurationRepegOverPriceSpread()).toString() != durationRepegOverPriceSpread) {
        await waitForTx(
            await clearingHouseConfig.setDurationRepegOverPriceSpread(durationRepegOverPriceSpread), 'await clearingHouseConfig.setDurationRepegOverPriceSpread(' + durationRepegOverPriceSpread + ')'
        )
    }
    if ((await insuranceFund.getClearingHouse()).toLowerCase() != clearingHouse.address.toLowerCase()) {
        await waitForTx(
            await insuranceFund.setClearingHouse(clearingHouse.address), 'insuranceFund.setClearingHouse(clearingHouse.address)'
        )
    }
    if ((await clearingHouse.getDelegateApproval()).toLowerCase() != limitOrderBook.address.toLowerCase()) {
        await waitForTx(
            await clearingHouse.setDelegateApproval(limitOrderBook.address), 'await clearingHouse.setDelegateApproval(limitOrderBook.address)'
        )
    }

    // new update for open protocol
    if ((await nftOracle.getPriceAdmin()).toLowerCase() != priceAdmin.address.toLowerCase()) {
        await waitForTx(
            await nftOracle.setPriceAdmin(priceAdmin.address),
            'nftOracle.setPriceAdmin(' + priceAdmin.address + ')'
        )
    }
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
        await marketRegistry.setMaxQuoteTickCrossedGlobal(parseEther('1000')),
        'marketRegistry.setMaxQuoteTickCrossedGlobal(parseEther(1000))'
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