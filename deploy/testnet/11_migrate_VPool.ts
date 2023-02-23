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
    // 
    var proxyAdmin = await hre.ethers.getContractAt('ProxyAdmin', deployData.proxyAdminAddress);
    // 
    if (deployData.vPool.implAddress == undefined || deployData.vPool.implAddress == '') {
        let VPool = await hre.ethers.getContractFactory("VPool", {
            libraries: {
                UniswapV3Broker: deployData.uniswapV3Broker.address,
                GenericLogic: deployData.genericLogic.address,
                ClearingHouseLogic: deployData.clearingHouseLogic.address,
            },
        });
        const vPool = await waitForDeploy(await VPool.deploy())
        {
            deployData.vPool.implAddress = vPool.address;
            deployData = (await saveDB(network, deployData))
            console.log('vPool is deployed', vPool.address)
        }
    }
    if (deployData.vPool.address == undefined || deployData.vPool.address == '') {
        var vPool = await hre.ethers.getContractAt('VPool', deployData.vPool.implAddress);
        var initializeData = vPool.interface.encodeFunctionData('initialize', [deployData.marketRegistry.address, deployData.clearingHouseConfig.address]);
        var transparentUpgradeableProxy = await waitForDeploy(
            await TransparentUpgradeableProxy.deploy(
                deployData.vPool.implAddress,
                proxyAdmin.address,
                initializeData,
            )
        );
        {
            deployData.vPool.address = transparentUpgradeableProxy.address;
            deployData = (await saveDB(network, deployData))
            console.log('vPool TransparentUpgradeableProxy is deployed', transparentUpgradeableProxy.address)
        }
    }
    {
        await upgradeContract(proxyAdmin as ProxyAdmin, deployData.vPool.address, deployData.vPool.implAddress)
    }
    {
        var genericLogic = await hre.ethers.getContractAt('GenericLogic', deployData.genericLogic.address);
        await verifyContract(
            deployData,
            network,
            deployData.vPool.implAddress,
            [],
            {
                GenericLogic: genericLogic.address,
            },
            "contracts/VPool.sol:VPool",
        )
    }
    {
        var vPool = await hre.ethers.getContractAt('VPool', deployData.vPool.implAddress);
        var initializeData = vPool.interface.encodeFunctionData('initialize', [deployData.marketRegistry.address, deployData.clearingHouseConfig.address]);
        await verifyContract(
            deployData,
            network,
            deployData.vPool.address,
            [
                deployData.vPool.implAddress,
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