import fs from "fs";

import hre, { ethers } from "hardhat";

import { encodePriceSqrt } from "../../test/shared/utilities";
import { AccountBalance, BaseToken, VPool, MarketRegistry, NftPriceFeed, QuoteToken, UniswapV3Pool } from "../../typechain";
import { getMaxTickRange } from "../../test/helper/number";
import helpers from "../helpers";
import { formatEther, formatUnits, parseEther } from "ethers/lib/utils";
const { waitForTx, tryWaitForTx, loadDB, saveDB } = helpers;


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
    {
        deployData.priceAdminAddress = maker.address
        deployData = (await saveDB(network, deployData))
    }

    // deploy UniV3 factory
    var clearingHouseConfig = await hre.ethers.getContractAt('ClearingHouseConfig', deployData.clearingHouseConfig.address);

    var durationRepegOverPriceSpread = '3600';
    if ((await clearingHouseConfig.getDurationRepegOverPriceSpread()).toString() != durationRepegOverPriceSpread) {
        await waitForTx(
            await clearingHouseConfig.setDurationRepegOverPriceSpread(durationRepegOverPriceSpread),
            'await clearingHouseConfig.setDurationRepegOverPriceSpread(' + durationRepegOverPriceSpread + ')'
        )
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});