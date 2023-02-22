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
    if (deployData.exchange.implAddress == undefined || deployData.exchange.implAddress == '') {
        let Exchange = await hre.ethers.getContractFactory("Exchange", {
            libraries: {
                UniswapV3Broker: deployData.uniswapV3Broker.address,
                GenericLogic: deployData.genericLogic.address,
                ClearingHouseLogic: deployData.clearingHouseLogic.address,
            },
        });
        const exchange = await waitForDeploy(await Exchange.deploy())
        {
            deployData.exchange.implAddress = exchange.address;
            deployData = (await saveDB(network, deployData))
            console.log('exchange is deployed', exchange.address)
        }
    }
    if (deployData.exchange.address == undefined || deployData.exchange.address == '') {
        var exchange = await hre.ethers.getContractAt('Exchange', deployData.exchange.implAddress);
        var initializeData = exchange.interface.encodeFunctionData('initialize', [deployData.marketRegistry.address, deployData.clearingHouseConfig.address]);
        var transparentUpgradeableProxy = await waitForDeploy(
            await TransparentUpgradeableProxy.deploy(
                deployData.exchange.implAddress,
                proxyAdmin.address,
                initializeData,
            )
        );
        {
            deployData.exchange.address = transparentUpgradeableProxy.address;
            deployData = (await saveDB(network, deployData))
            console.log('exchange TransparentUpgradeableProxy is deployed', transparentUpgradeableProxy.address)
        }
    }
    {
        await upgradeContract(proxyAdmin as ProxyAdmin, deployData.exchange.address, deployData.exchange.implAddress)
    }
    {
        var genericLogic = await hre.ethers.getContractAt('GenericLogic', deployData.genericLogic.address);
        await verifyContract(
            deployData,
            network,
            deployData.exchange.implAddress,
            [],
            {
                GenericLogic: genericLogic.address,
            },
            "contracts/Exchange.sol:Exchange",
        )
    }
    {
        var exchange = await hre.ethers.getContractAt('Exchange', deployData.exchange.implAddress);
        var initializeData = exchange.interface.encodeFunctionData('initialize', [deployData.marketRegistry.address, deployData.clearingHouseConfig.address]);
        await verifyContract(
            deployData,
            network,
            deployData.exchange.address,
            [
                deployData.exchange.implAddress,
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