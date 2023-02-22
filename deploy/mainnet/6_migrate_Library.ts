import fs from "fs";

import hre, { ethers } from "hardhat";
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
    const GenericLogic = await hre.ethers.getContractFactory("GenericLogic");
    if (deployData.genericLogic.address == undefined || deployData.genericLogic.address == '') {
        const genericLogic = await waitForDeploy(await GenericLogic.deploy())
        {
            deployData.genericLogic.address = genericLogic.address;
            deployData = (await saveDB(network, deployData))
            console.log('GenericLogic is deployed', genericLogic.address)
        }
    }
    var genericLogic = await hre.ethers.getContractAt('GenericLogic', deployData.genericLogic.address);
    const ClearingHouseLogic = await hre.ethers.getContractFactory("ClearingHouseLogic", {
        libraries: {
            GenericLogic: genericLogic.address,
        },
    });
    if (deployData.clearingHouseLogic.address == undefined || deployData.clearingHouseLogic.address == '') {
        const clearingHouseLogic = await waitForDeploy(await ClearingHouseLogic.deploy())
        {
            deployData.clearingHouseLogic.address = clearingHouseLogic.address;
            deployData = (await saveDB(network, deployData))
            console.log('ClearingHouseLogic is deployed', clearingHouseLogic.address)
        }
    }
    {
        await verifyContract(
            deployData,
            network,
            deployData.genericLogic.address,
            [],
            {},
            "contracts/lib/GenericLogic.sol:GenericLogic",
        )
    }
    {
        var genericLogic = await hre.ethers.getContractAt('GenericLogic', deployData.genericLogic.address);
        await verifyContract(
            deployData,
            network,
            deployData.clearingHouseLogic.address,
            [],
            {
                GenericLogic: genericLogic.address,
            },
            "contracts/lib/ClearingHouseLogic.sol:ClearingHouseLogic",
        )
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
// main().catch((error) => {
//     console.error(error);
//     process.exitCode = 1;
// });