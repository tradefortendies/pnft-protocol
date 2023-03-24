import fs from "fs";

import bn from "bignumber.js"

import hre, { ethers } from "hardhat";

import { encodePriceSqrt, formatSqrtPriceX96ToPrice } from "../../test/shared/utilities";
import { AccountBalance, BaseToken, ClearingHouse, ClearingHouseConfig, VPool, GenericLogic, InsuranceFund, MarketRegistry, MockPNFTToken, NftPriceFeed, QuoteToken, RewardMiner, TestERC20, TestFaucet, UniswapV3Pool, Vault, LimitOrderBook, ReferralPayment, NFTOracle, VirtualToken } from "../../typechain";
import { getMaxTickRange, priceToTick } from "../../test/helper/number";
import helpers from "../helpers";
import { formatEther, parseEther, parseUnits } from "ethers/lib/utils";
const { waitForTx, tryWaitForTx, loadDB, saveDB } = helpers;

import migrateLibrary from "./6_migrate_Library";
import migrateClearingHouseConfig from "./7_migrate_ClearingHouseConfig";
import migrateVPool from "./10_migrate_VPool";
import migrateInsuranceFund from "./11_migrate_InsuranceFund";
import migrateVault from "./12_migrate_Vault";
import migrateClearingHouse from "./13_migrate_ClearingHouse";

import { } from "../../test/helper/clearingHouseHelper";
import { BigNumber, providers } from "ethers";
import {
    signTypedData, SignTypedDataVersion, TypedMessage,
} from "@metamask/eth-sig-util";


async function main() {
    await deploy();
}

export default deploy;

async function deploy() {
    console.log('START')
    // import migrateLibrary from "./6_migrate_Library";
    {
        console.log('migrateLibrary -- START --')
        await migrateLibrary();
        console.log('migrateLibrary -- END --')
    }
    // import migrateClearingHouseConfig from "./7_migrate_ClearingHouseConfig";
    {
        console.log('migrateClearingHouseConfig -- START --')
        await migrateClearingHouseConfig();
        console.log('migrateClearingHouseConfig -- END --')
    }
    // import migrateVPool from "./11_migrate_VPool";
    {
        console.log('migrateVPool -- START --')
        await migrateVPool();
        console.log('migrateVPool -- END --')
    }
    // import migrateInsuranceFund from "./12_migrate_InsuranceFund";
    {
        console.log('migrateInsuranceFund -- START --')
        await migrateInsuranceFund();
        console.log('migrateInsuranceFund -- END --')
    }
    // import migrateVault from "./13_migrate_Vault";
    {
        console.log('migrateVault -- START --')
        await migrateVault();
        console.log('migrateVault -- END --')
    }
    // import migrateClearingHouse from "./15_migrate_ClearingHouse";
    {
        console.log('migrateClearingHouse -- START --')
        await migrateClearingHouse();
        console.log('migrateClearingHouse -- END --')
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});