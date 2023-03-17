import fs from "fs";

import hre from "hardhat";
import helpers from "../helpers";

import { ProxyAdmin } from "../../typechain/openzeppelin/ProxyAdmin";
import { parseEther } from "ethers/lib/utils";
import { NFTOracle } from "../../typechain";

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
    const NFTOracle = await hre.ethers.getContractFactory("NFTOracle");
    // 
    var proxyAdmin = await hre.ethers.getContractAt('ProxyAdmin', deployData.proxyAdminAddress);
    // 
    if (deployData.nftOracle.implAddress == undefined || deployData.nftOracle.implAddress == '') {
        const nftOracle = await waitForDeploy(await NFTOracle.deploy())
        {
            deployData.nftOracle.implAddress = nftOracle.address;
            deployData = (await saveDB(network, deployData))
            console.log('nftOracle is deployed', nftOracle.address)
        }
    }
    if (deployData.nftOracle.address == undefined || deployData.nftOracle.address == '') {
        let nftOracle = await hre.ethers.getContractAt('NFTOracle', deployData.nftOracle.implAddress);
        var initializeData = nftOracle.interface.encodeFunctionData('initialize', []);
        var transparentUpgradeableProxy = await waitForDeploy(
            await TransparentUpgradeableProxy.deploy(
                deployData.nftOracle.implAddress,
                proxyAdmin.address,
                initializeData,
            )
        );
        {
            deployData.nftOracle.address = transparentUpgradeableProxy.address;
            deployData = (await saveDB(network, deployData))
            console.log('nftOracle TransparentUpgradeableProxy is deployed', transparentUpgradeableProxy.address)
        }
    }
    {
        await upgradeContract(proxyAdmin as ProxyAdmin, deployData.nftOracle.address, deployData.nftOracle.implAddress)
    }
    // {
    //     await verifyContract(
    //         deployData,
    //         network,
    //         deployData.nftOracle.implAddress,
    //         [],
    //         {},
    //         "contracts/NFTOracle.sol:NFTOracle",
    //     )
    // }
    // {
    //     var nftOracle = await hre.ethers.getContractAt('NFTOracle', deployData.nftOracle.implAddress);
    //     var initializeData = nftOracle.interface.encodeFunctionData('initialize', initData);
    //     await verifyContract(
    //         deployData,
    //         network,
    //         deployData.nftOracle.address,
    //         [
    //             deployData.nftOracle.implAddress,
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