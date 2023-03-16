import fs from "fs";

import bn from "bignumber.js"

import hre, { ethers } from "hardhat";

import { encodePriceSqrt, formatSqrtPriceX96ToPrice } from "../../test/shared/utilities";
import { AccountBalance, BaseToken, ClearingHouse, ClearingHouseConfig, VPool, InsuranceFund, MarketRegistry, MockPNFTToken, NftPriceFeed, QuoteToken, RewardMiner, TestFaucet, UniswapV3Pool, Vault } from "../../typechain";
import { getMaxTickRange } from "../../test/helper/number";
import helpers from "../helpers";
import { formatEther, parseEther } from "ethers/lib/utils";
const { waitForTx, tryWaitForTx, loadDB } = helpers;


async function main() {
    await deploy();
}

export default deploy;

async function deploy() {

    const network = hre.network.name;
    let deployData = (await loadDB(network))

    const [admin, maker, priceAdmin, platformFund, trader1, trader2, trader3, trader4, hieuq] = await ethers.getSigners()

    // deploy UniV3 factory
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

    let baseTokens = [
        deployData.vBAYC,
        deployData.vCRYPTOPUNKS,
        deployData.vAZUKI,
    ];
    for (let i = 0; i < baseTokens.length; i++) {
        let baseTokenAddr = baseTokens[i].address
        await waitForTx(
            await clearingHouse.connect(platformFund).repeg(baseTokenAddr),
            'clearingHouse.repeg(' + baseTokenAddr + ')'
        )
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});