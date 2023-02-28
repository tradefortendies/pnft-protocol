import fs from "fs";

import hre from "hardhat";
import helpers from "../helpers";

import { ProxyAdmin } from "../../typechain/openzeppelin/ProxyAdmin";
import { BaseContract } from "ethers";
import { isAscendingTokenOrder } from "../../test/shared/utilities";
import { BaseToken } from "../../typechain";

const { waitForDeploy, waitForTx, verifyContract, upgradeContract, loadDB, saveDB } = helpers;

async function main() {
    await deploy();
}

export default deploy;

async function deploy() {
    const network = hre.network.name;
    let deployData = (await loadDB(network))
    // 
    const TransparentUpgradeableProxy = await hre.ethers.getContractFactory('TransparentUpgradeableProxy');
    // 
    var proxyAdmin = await hre.ethers.getContractAt('ProxyAdmin', deployData.proxyAdminAddress);
    const vETH = (await hre.ethers.getContractAt('QuoteToken', deployData.vETH.address)) as BaseToken;
    // 
    const BaseToken = await hre.ethers.getContractFactory("BaseToken");
    // 
    if (deployData.baseToken.implAddress == undefined || deployData.baseToken.implAddress == '') {
        let baseToken = await waitForDeploy(await BaseToken.deploy());
        {
            deployData.baseToken.implAddress = baseToken.address;
            deployData = (await saveDB(network, deployData))
            console.log('baseToken is deployed', baseToken.address)
        }
    }
    var baseToken = await hre.ethers.getContractAt('BaseToken', deployData.baseToken.implAddress);
    let baseTokens = [
        deployData.vBAYC,
        deployData.vCRYPTOPUNKS,
        deployData.vAZUKI,
    ];
    let nftPriceFeeds = [
        deployData.nftPriceFeedBAYC,
        deployData.nftPriceFeedCRYPTOPUNKS,
        deployData.nftPriceFeedAZUKI,
    ];
    for (let i = 0; i < baseTokens.length; i++) {
        var baseVToken = baseTokens[i]
        var nftPriceFeed = nftPriceFeeds[i]
        if (baseVToken.address == undefined || baseVToken.address == '') {
            var initializeData = baseToken.interface.encodeFunctionData('initialize', [baseVToken.name, baseVToken.symbol, nftPriceFeed.address]);
            var transparentUpgradeableProxy: BaseContract
            do {
                transparentUpgradeableProxy = await waitForDeploy(
                    await TransparentUpgradeableProxy.deploy(
                        baseToken.address,
                        proxyAdmin.address,
                        initializeData,
                    )
                ) as BaseContract;
            } while (!isAscendingTokenOrder(transparentUpgradeableProxy.address.toString(), vETH.address))
            {
                baseVToken.address = transparentUpgradeableProxy.address;
                deployData = (await saveDB(network, deployData))
                console.log('vBaseToken TransparentUpgradeableProxy is deployed', transparentUpgradeableProxy.address)
            }
        }
        {
            await upgradeContract(proxyAdmin as ProxyAdmin, baseVToken.address, deployData.baseToken.implAddress)
        }
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
// main().catch((error) => {
//     console.error(error);
//     process.exitCode = 1;
// });