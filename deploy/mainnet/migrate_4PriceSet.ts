import fs from "fs";

import hre, { ethers } from "hardhat";

import { encodePriceSqrt } from "../../test/shared/utilities";
import { AccountBalance, BaseToken, MarketRegistry, NftPriceFeed, QuoteToken, UniswapV3Pool } from "../../typechain";
import { getMaxTickRange } from "../../test/helper/number";
import helpers from "../helpers";
import { formatEther, parseEther } from "ethers/lib/utils";
const { waitForTx, tryWaitForTx, loadDB } = helpers;


async function main() {
    await deploy();
}

export default deploy;

async function deploy() {
    const network = hre.network.name;
    let deployData = (await loadDB(network))
    let priceData: PriceData;
    {
        let dataText = await fs.readFileSync(process.cwd() + '/deploy/mainnet/address/prices.json')
        priceData = JSON.parse(dataText.toString())
    }
    // 
    const [admin, maker, priceAdmin] = await ethers.getSigners()

    let nftPriceFeeds = [
        deployData.nftPriceFeedBAYC,
        deployData.nftPriceFeedCRYPTOPUNKS,
        deployData.nftPriceFeedAZUKI,
    ];
    let priceKeys = [
        'priceBAYC',
        'priceCRYPTOPUNKS',
        'priceAZUKI',
    ];
    for (let i = 0; i < nftPriceFeeds.length; i++) {
        console.log(
            '--------------------------------------',
            priceKeys[i].substring(5),
            '--------------------------------------',
        )
        var nftPriceFeedAddress = nftPriceFeeds[i].address
        var initPrice = formatEther(priceData[priceKeys[i]]);

        var priceFeed = (await hre.ethers.getContractAt('NftPriceFeed', nftPriceFeedAddress)) as NftPriceFeed;
        if ((await priceFeed.priceFeedAdmin()).toLowerCase() != priceAdmin.address.toLowerCase()) {
            await waitForTx(
                await priceFeed.setPriceFeedAdmin(priceAdmin.address),
                'priceFeed.setPriceFeedAdmin(priceAdmin.address)'
            )
        }

        var priceFeed = (await hre.ethers.getContractAt('NftPriceFeed', nftPriceFeedAddress)) as NftPriceFeed;
        if (!(await priceFeed.getPrice(0)).eq(parseEther(initPrice))) {
            await waitForTx(
                await priceFeed.connect(priceAdmin).setPrice(parseEther(initPrice)),
                'priceFeed.connect(priceAdmin).setPrice(parseEther(' + initPrice + '))'
            )
        }
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});