import fs from "fs";

import hre from "hardhat";
import helpers from "../helpers";

import { ProxyAdmin } from "../../typechain/openzeppelin/ProxyAdmin";

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
    const PNFTToken = await hre.ethers.getContractFactory("PNFTToken");
    // 
    var proxyAdmin = await hre.ethers.getContractAt('ProxyAdmin', deployData.proxyAdminAddress);
    // 
    if (deployData.pNFTToken.implAddress == undefined || deployData.pNFTToken.implAddress == '') {
        const pNFTToken = await waitForDeploy(await PNFTToken.deploy())
        {
            deployData.pNFTToken.implAddress = pNFTToken.address;
            deployData = (await saveDB(network, deployData))
            console.log('pNFTToken is deployed', pNFTToken.address)
        }
    }
    if (deployData.pNFTToken.address == undefined || deployData.pNFTToken.address == '') {
        var pNFTToken = await hre.ethers.getContractAt('PNFTToken', deployData.pNFTToken.implAddress);
        var initializeData = pNFTToken.interface.encodeFunctionData('initialize', [
            deployData.pNFTToken.name,
            deployData.pNFTToken.symbol,
        ]);
        var transparentUpgradeableProxy = await waitForDeploy(
            await TransparentUpgradeableProxy.deploy(
                deployData.pNFTToken.implAddress,
                proxyAdmin.address,
                initializeData,
            )
        );
        {
            deployData.pNFTToken.address = transparentUpgradeableProxy.address;
            deployData = (await saveDB(network, deployData))
            console.log('pNFTToken TransparentUpgradeableProxy is deployed', transparentUpgradeableProxy.address)
        }
    }
    {
        await upgradeContract(proxyAdmin as ProxyAdmin, deployData.pNFTToken.address, deployData.pNFTToken.implAddress)
    }
    {
        await verifyContract(
            deployData,
            network,
            deployData.pNFTToken.implAddress,
            [],
            {},
            "contracts/test/PNFTToken.sol:PNFTToken",
        )
    }
    {
        var pNFTToken = await hre.ethers.getContractAt('PNFTToken', deployData.pNFTToken.implAddress);
        var initializeData = pNFTToken.interface.encodeFunctionData('initialize', [
            deployData.pNFTToken.name,
            deployData.pNFTToken.symbol,
        ]);
        await verifyContract(
            deployData,
            network,
            deployData.pNFTToken.address,
            [
                deployData.pNFTToken.implAddress,
                proxyAdmin.address,
                initializeData,
            ],
            {},
            "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy",
        )
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
// main().catch((error) => {
//     console.error(error);
//     process.exitCode = 1;
// });