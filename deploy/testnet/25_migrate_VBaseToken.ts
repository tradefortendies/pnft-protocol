import fs from "fs";

import hre from "hardhat";
import helpers from "../helpers";

import { ProxyAdmin } from "../../typechain/openzeppelin/ProxyAdmin";
import { parseEther } from "ethers/lib/utils";
import { VirtualToken } from "../../typechain";

const { waitForDeploy, verifyContract, loadDB, saveDB, upgradeContract } = helpers;

async function main() {
    await deploy();
}

export default deploy;

async function deploy() {
    const network = hre.network.name;
    let deployData = (await loadDB(network))
    // 
    var proxyAdmin = await hre.ethers.getContractAt('ProxyAdmin', deployData.proxyAdminAddress);
    // 
    const TransparentUpgradeableProxy = await hre.ethers.getContractFactory('TransparentUpgradeableProxy');
    const VirtualToken = await hre.ethers.getContractFactory("VirtualToken");
    // 
    // 
    if (deployData.vBaseToken.address == undefined || deployData.vBaseToken.address == '') {
        const vBaseToken = await waitForDeploy(await VirtualToken.deploy())
        {
            deployData.vBaseToken.address = vBaseToken.address;
            deployData = (await saveDB(network, deployData))
            console.log('vBaseToken is deployed', vBaseToken.address)
        }
    }
    // {
    //     await verifyContract(
    //         deployData,
    //         network,
    //         deployData.vBaseToken.address,
    //         [],
    //         {},
    //         "contracts/VirtualToken.sol:VirtualToken",
    //     )
    // }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
// main().catch((error) => {
//     console.error(error);
//     process.exitCode = 1;
// });