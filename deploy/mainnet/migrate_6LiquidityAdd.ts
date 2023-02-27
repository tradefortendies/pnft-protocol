import fs from "fs";

import hre, { ethers } from "hardhat";

import { parseEther } from "ethers/lib/utils";
import { ClearingHouse, VPool, TestERC20, Vault } from "../../typechain";

import helpers from "../helpers";
import { priceToTick } from "../../test/helper/number";
const { waitForTx, loadDB } = helpers;


async function main() {
    await deploy();
}

export default deploy;

async function deploy() {
    const network = hre.network.name;
    let deployData = (await loadDB(network))
    // 

    const [admin, maker, priceAdmin] = await ethers.getSigners()

    // deploy UniV3 factory
    var clearingHouse = (await hre.ethers.getContractAt('ClearingHouse', deployData.clearingHouse.address)) as ClearingHouse;

    let baseTokens = [
        deployData.vBAYC,
        deployData.vCRYPTOPUNKS,
        deployData.vAZUKI,
    ];
    let priceKeys = [
        'priceBAYC',
        'priceCRYPTOPUNKS',
        'priceAZUKI',
    ];

    let initLiquidities = [
        parseEther('700.01'),
        parseEther('752.16'),
        parseEther('1572.20'),
    ];

    for (let i = 0; i < baseTokens.length; i++) {
        console.log(
            '--------------------------------------',
            priceKeys[i].substring(5),
            '--------------------------------------',
        )

        var baseTokenAddress = baseTokens[i].address
        var initLiquidity = initLiquidities[i]

        const baseToken = await hre.ethers.getContractAt('BaseToken', baseTokenAddress);
        let liquidity = await clearingHouse.getLiquidity(baseToken.address)
        if (initLiquidity.gt(liquidity)) {
            await waitForTx(
                await clearingHouse.connect(maker).addLiquidity({
                    baseToken: baseToken.address,
                    liquidity: initLiquidity.sub(liquidity),
                    deadline: ethers.constants.MaxUint256,
                }),
                'clearingHouse.connect(maker).addLiquidity'
            )
        } else if (initLiquidity.lt(liquidity)) {
            await waitForTx(
                await clearingHouse.connect(maker).removeLiquidity({
                    baseToken: baseToken.address,
                    liquidity: liquidity.sub(initLiquidity),
                    deadline: ethers.constants.MaxUint256,
                }),
                'clearingHouse.connect(maker).removeLiquidity'
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