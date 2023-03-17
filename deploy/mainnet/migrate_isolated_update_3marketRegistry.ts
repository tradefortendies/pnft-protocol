import fs from "fs";

import bn from "bignumber.js"

import hre, { ethers } from "hardhat";

import { encodePriceSqrt, formatSqrtPriceX96ToPrice } from "../../test/shared/utilities";
import { AccountBalance, BaseToken, ClearingHouse, ClearingHouseConfig, VPool, GenericLogic, InsuranceFund, MarketRegistry, MockPNFTToken, NftPriceFeed, QuoteToken, RewardMiner, TestERC20, TestFaucet, UniswapV3Pool, Vault, LimitOrderBook, ReferralPayment, NFTOracle, VirtualToken } from "../../typechain";
import { getMaxTickRange, priceToTick } from "../../test/helper/number";
import helpers from "../helpers";
import { formatEther, parseEther, parseUnits } from "ethers/lib/utils";
const { waitForTx, tryWaitForTx, loadDB, saveDB } = helpers;

import migrateQuoteToken from "./4_migrate_QuoteToken";
import migrateBaseTokenAll from "./5_migrate_BaseToken_All";
import migrateLibrary from "./6_migrate_Library";
import migrateClearingHouseConfig from "./7_migrate_ClearingHouseConfig";
import migrateMarketRegistry from "./8_migrate_MarketRegistry";
import migrateAccountBalance from "./9_migrate_AccountBalance";
import migrateVPool from "./10_migrate_VPool";
import migrateInsuranceFund from "./11_migrate_InsuranceFund";
import migrateVault from "./12_migrate_Vault";
import migrateClearingHouse from "./13_migrate_ClearingHouse";
import migrate_NFTOracle from "./24_migrate_NFTOracle";
import migrate_VBaseToken from "./25_migrate_VBaseToken";
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
    // import migrateMarketRegistry from "./8_migrate_MarketRegistry";
    {
        console.log('migrateMarketRegistry -- START --')
        await migrateMarketRegistry();
        console.log('migrateMarketRegistry -- END --')
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});