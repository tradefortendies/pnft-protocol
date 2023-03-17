import fs from "fs";

import bn from "bignumber.js"

import hre, { ethers } from "hardhat";

import { encodePriceSqrt, formatSqrtPriceX96ToPrice } from "../../test/shared/utilities";
import { AccountBalance, BaseToken, ClearingHouse, ClearingHouseConfig, VPool, GenericLogic, InsuranceFund, MarketRegistry, MockPNFTToken, NftPriceFeed, QuoteToken, RewardMiner, TestERC20, TestFaucet, UniswapV3Pool, Vault } from "../../typechain";
import { getMaxTickRange, priceToTick } from "../../test/helper/number";
import helpers from "../helpers";
import { formatEther, parseEther } from "ethers/lib/utils";
const { waitForTx, tryWaitForTx, loadDB } = helpers;

import migrateAdmin from "./1_migrate_Admin";
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
import migratePNFTToken from "./14_migrate_PNFTToken";
import migrateRewardMiner from "./15_migrate_RewardMiner";
import { } from "../../test/helper/clearingHouseHelper";
import { providers } from "ethers";
const { verifyContract } = helpers;


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
    console.log('START')
    {
    //     {
    //         await verifyContract(
    //             deployData,
    //             network,
    //             deployData.vETH.implAddress,
    //             [],
    //             {},
    //             "contracts/QuoteToken.sol:QuoteToken",
    //         )
    //     }
    // }
    // {
    //     {
    //         await verifyContract(
    //             deployData,
    //             network,
    //             deployData.baseToken.implAddress,
    //             [],
    //             {},
    //             "contracts/BaseToken.sol:BaseToken",
    //         )
    //     }
    // }
    // {
    //     {
    //         await verifyContract(
    //             deployData,
    //             network,
    //             deployData.uniswapV3Broker.address,
    //             [],
    //             {},
    //             "contracts/lib/UniswapV3Broker.sol:UniswapV3Broker",
    //         )
    //     }
    //     {
    //         await verifyContract(
    //             deployData,
    //             network,
    //             deployData.genericLogic.address,
    //             [],
    //             {
    //                 UniswapV3Broker: deployData.uniswapV3Broker.address,
    //             },
    //             "contracts/lib/GenericLogic.sol:GenericLogic",
    //         )
    //     }
        {
            await verifyContract(
                deployData,
                network,
                deployData.clearingHouseLogic.address,
                [],
                {
                    // UniswapV3Broker: deployData.uniswapV3Broker.address,
                    // GenericLogic: deployData.genericLogic.address,
                },
                "contracts/lib/ClearingHouseLogic.sol:ClearingHouseLogic",
            )
        }
    }
    {
        {
            await verifyContract(
                deployData,
                network,
                deployData.clearingHouseConfig.implAddress,
                [],
                {},
                "contracts/ClearingHouseConfig.sol:ClearingHouseConfig",
            )
        }
    }
    {
        {
            await verifyContract(
                deployData,
                network,
                deployData.marketRegistry.implAddress,
                [],
                {
                    UniswapV3Broker: deployData.uniswapV3Broker.address,
                },
                "contracts/MarketRegistry.sol:MarketRegistry",
            )
        }
    }
    {
        {
            await verifyContract(
                deployData,
                network,
                deployData.accountBalance.implAddress,
                [],
                {},
                "contracts/AccountBalance.sol:AccountBalance",
            )
        }
    }
    {
        {
            await verifyContract(
                deployData,
                network,
                deployData.vPool.implAddress,
                [],
                {
                    UniswapV3Broker: deployData.uniswapV3Broker.address,
                    GenericLogic: deployData.genericLogic.address,
                    ClearingHouseLogic: deployData.clearingHouseLogic.address,
                },
                "contracts/VPool.sol:VPool",
            )
        }
    }
    {
        {
            await verifyContract(
                deployData,
                network,
                deployData.insuranceFund.implAddress,
                [],
                {},
                "contracts/InsuranceFund.sol:InsuranceFund",
            )
        }
    }
    {
        {
            await verifyContract(
                deployData,
                network,
                deployData.vault.implAddress,
                [],
                {},
                "contracts/Vault.sol:Vault",
            )
        }
    }
    {
        {
            await verifyContract(
                deployData,
                network,
                deployData.clearingHouse.implAddress,
                [],
                {
                    UniswapV3Broker: deployData.uniswapV3Broker.address,
                    GenericLogic: deployData.genericLogic.address,
                    ClearingHouseLogic: deployData.clearingHouseLogic.address,
                },
                "contracts/ClearingHouse.sol:ClearingHouse",
            )
        }
    }
    {
        await verifyContract(
            deployData,
            network,
            deployData.nftOracle.implAddress,
            [],
            {},
            "contracts/NFTOracle.sol:NFTOracle",
        )
    }
    {
        await verifyContract(
            deployData,
            network,
            deployData.vBaseToken.address,
            [],
            {},
            "contracts/VirtualToken.sol:VirtualToken",
        )
    }
    console.log('END')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});