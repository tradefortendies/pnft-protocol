import fs from "fs";

import hre from "hardhat";
import helpers from "../helpers";

import { ProxyAdmin } from "../../typechain/openzeppelin/ProxyAdmin";
import { parseEther } from "ethers/lib/utils";
import { ReferralPayment } from "../../typechain";

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
    const ReferralPayment = await hre.ethers.getContractFactory("ReferralPayment");
    // 
    var proxyAdmin = await hre.ethers.getContractAt('ProxyAdmin', deployData.proxyAdminAddress);
    // 
    if (deployData.referralPayment.implAddress == undefined || deployData.referralPayment.implAddress == '') {
        const referralPayment = await waitForDeploy(await ReferralPayment.deploy())
        {
            deployData.referralPayment.implAddress = referralPayment.address;
            deployData = (await saveDB(network, deployData))
            console.log('referralPayment is deployed', referralPayment.address)
        }
    }
    let initData = [deployData.pNFTToken.address, deployData.referralAdminAddress]
    if (deployData.referralPayment.address == undefined || deployData.referralPayment.address == '') {
        let referralPayment = await hre.ethers.getContractAt('ReferralPayment', deployData.referralPayment.implAddress);
        var initializeData = referralPayment.interface.encodeFunctionData('initialize', initData);
        var transparentUpgradeableProxy = await waitForDeploy(
            await TransparentUpgradeableProxy.deploy(
                deployData.referralPayment.implAddress,
                proxyAdmin.address,
                initializeData,
            )
        );
        {
            deployData.referralPayment.address = transparentUpgradeableProxy.address;
            deployData = (await saveDB(network, deployData))
            console.log('referralPayment TransparentUpgradeableProxy is deployed', transparentUpgradeableProxy.address)
        }
    }
    {
        await upgradeContract(proxyAdmin as ProxyAdmin, deployData.referralPayment.address, deployData.referralPayment.implAddress)
    }
    // {
    //     await verifyContract(
    //         deployData,
    //         network,
    //         deployData.referralPayment.implAddress,
    //         [],
    //         {},
    //         "contracts/test/ReferralPayment.sol:ReferralPayment",
    //     )
    // }
    // {
    //     var referralPayment = await hre.ethers.getContractAt('ReferralPayment', deployData.referralPayment.implAddress);
    //     var initializeData = referralPayment.interface.encodeFunctionData('initialize', initData);
    //     await verifyContract(
    //         deployData,
    //         network,
    //         deployData.referralPayment.address,
    //         [
    //             deployData.referralPayment.implAddress,
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