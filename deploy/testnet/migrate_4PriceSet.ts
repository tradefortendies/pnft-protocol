import fs from "fs";

import hre, { ethers } from "hardhat";

import { encodePriceSqrt } from "../../test/shared/utilities";
import { AccountBalance, BaseToken, MarketRegistry, NFTOracle, NftPriceFeed, QuoteToken, UniswapV3Pool } from "../../typechain";
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
        let dataText = await fs.readFileSync(process.cwd() + '/deploy/testnet/address/prices.json')
        priceData = JSON.parse(dataText.toString())
    }
    // 
    const [admin, maker, priceAdmin, platformFund, trader, liquidator] = await ethers.getSigners()

    var nftOracle = (await hre.ethers.getContractAt('NFTOracle', deployData.nftOracle.address)) as NFTOracle;

    let baseTokens = [
        deployData.vBAYC,
        deployData.vMAYC,
        deployData.vCRYPTOPUNKS,
        deployData.vMOONBIRD,
        deployData.vAZUKI,
        deployData.vCLONEX,
        deployData.vDOODLE,
    ];
    let priceKeys = [
        'priceBAYC',
        'priceMAYC',
        'priceCRYPTOPUNKS',
        'priceMOONBIRD',
        'priceAZUKI',
        'priceCLONEX',
        'priceDOODLE'
    ];
    for (let i = 0; i < 7; i++) {
        console.log(
            '--------------------------------------',
            priceKeys[i].substring(5),
            '--------------------------------------',
        )
        var nftContractAddress = baseTokens[i].nftContract
        var initPrice = formatEther(priceData[priceKeys[i]]);
        // oracle price
        {
            await waitForTx(
                await nftOracle.connect(priceAdmin).setNftPrice(nftContractAddress, parseEther(initPrice)),
                'nftOracle.connect(priceAdmin).setNftPrice(' + nftContractAddress + ', parseEther(' + initPrice + '))'
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