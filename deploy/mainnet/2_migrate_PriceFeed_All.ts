import { formatEther, parseEther } from "ethers/lib/utils";
import fs from "fs";

import hre from "hardhat";
import { NftPriceFeed } from "../../typechain";
import helpers from "../helpers";

const { waitForDeploy, verifyContract, loadDB, saveDB, upgradeContract } = helpers;

async function main() {
    await deploy();
}

export default deploy;

async function deploy() {
    const network = hre.network.name;
    let deployData = (await loadDB(network))
    let nftPriceFeeds = [
        deployData.nftPriceFeedBAYC,
        deployData.nftPriceFeedCRYPTOPUNKS,
        deployData.nftPriceFeedAZUKI,
    ];
    for (let i = 0; i < nftPriceFeeds.length; i++) {
        var nftPriceFeed = nftPriceFeeds[i]
        if (nftPriceFeed.address == undefined || nftPriceFeed.address == '') {
            const NftPriceFeed = await hre.ethers.getContractFactory("NftPriceFeed")
            const priceFeed = (await waitForDeploy(await NftPriceFeed.deploy(nftPriceFeed.symbol))) as NftPriceFeed
            {
                nftPriceFeed.address = priceFeed.address
                deployData = (await saveDB(network, deployData))
                console.log('nftPriceFeed is deployed', priceFeed.address)
            }
        }
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
// main().catch((error) => {
//     console.error(error);
//     process.exitCode = 1;
// });