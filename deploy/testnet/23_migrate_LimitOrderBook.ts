import fs from "fs";

import hre from "hardhat";
import helpers from "../helpers";

import { ProxyAdmin } from "../../typechain/openzeppelin/ProxyAdmin";
import { parseEther } from "ethers/lib/utils";
import { LimitOrderBook } from "../../typechain";

const { waitForDeploy, verifyContract, loadDB, saveDB, upgradeContract } = helpers;

async function main() {
    await deploy();
}

export default deploy;

async function deploy() {
    const network = hre.network.name;
    let deployData = (await loadDB(network))
    // 
    const TransparentUpgradeableProxy = await hre.ethers.getContractFactory('TransparentUpgradeableProxy');
    const LimitOrderBook = await hre.ethers.getContractFactory("LimitOrderBook");
    // 
    var proxyAdmin = await hre.ethers.getContractAt('ProxyAdmin', deployData.proxyAdminAddress);
    // 
    if (deployData.limitOrderBook.implAddress == undefined || deployData.limitOrderBook.implAddress == '') {
        const limitOrderBook = await waitForDeploy(await LimitOrderBook.deploy())
        {
            deployData.limitOrderBook.implAddress = limitOrderBook.address;
            deployData = (await saveDB(network, deployData))
            console.log('limitOrderBook is deployed', limitOrderBook.address)
        }
    }
    let initData = ["pNFT LimitOrderBook", "1.0", deployData.clearingHouse.address, 1, parseEther('0.0003')]
    if (deployData.limitOrderBook.address == undefined || deployData.limitOrderBook.address == '') {
        let limitOrderBook = await hre.ethers.getContractAt('LimitOrderBook', deployData.limitOrderBook.implAddress);
        var initializeData = limitOrderBook.interface.encodeFunctionData('initialize', initData);
        var transparentUpgradeableProxy = await waitForDeploy(
            await TransparentUpgradeableProxy.deploy(
                deployData.limitOrderBook.implAddress,
                proxyAdmin.address,
                initializeData,
            )
        );
        {
            deployData.limitOrderBook.address = transparentUpgradeableProxy.address;
            deployData = (await saveDB(network, deployData))
            console.log('limitOrderBook TransparentUpgradeableProxy is deployed', transparentUpgradeableProxy.address)
        }
    }
    {
        await upgradeContract(proxyAdmin as ProxyAdmin, deployData.limitOrderBook.address, deployData.limitOrderBook.implAddress)
    }
    // {
    //     await verifyContract(
    //         deployData,
    //         network,
    //         deployData.limitOrderBook.implAddress,
    //         [],
    //         {},
    //         "contracts/test/LimitOrderBook.sol:LimitOrderBook",
    //     )
    // }
    // {
    //     var limitOrderBook = await hre.ethers.getContractAt('LimitOrderBook', deployData.limitOrderBook.implAddress);
    //     var initializeData = limitOrderBook.interface.encodeFunctionData('initialize', initData);
    //     await verifyContract(
    //         deployData,
    //         network,
    //         deployData.limitOrderBook.address,
    //         [
    //             deployData.limitOrderBook.implAddress,
    //             proxyAdmin.address,
    //             initializeData,
    //         ],
    //         {},
    //         "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy",
    //     )
    // }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
// main().catch((error) => {
//     console.error(error);
//     process.exitCode = 1;
// });