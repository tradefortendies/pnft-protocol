import fs from "fs";

import hre from "hardhat";
import helpers from "../helpers";
const { loadDB } = helpers;
import { } from "../../test/helper/clearingHouseHelper";
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
        {
            await verifyContract(
                deployData,
                network,
                deployData.vETH.implAddress,
                [],
                {},
                "contracts/QuoteToken.sol:QuoteToken",
            )
        }
    }
    {
        {
            await verifyContract(
                deployData,
                network,
                deployData.baseToken.implAddress,
                [],
                {},
                "contracts/BaseToken.sol:BaseToken",
            )
        }
    }
    {
        {
            await verifyContract(
                deployData,
                network,
                deployData.uniswapV3Broker.address,
                [],
                {},
                "contracts/lib/UniswapV3Broker.sol:UniswapV3Broker",
            )
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
            await verifyContract(
                deployData,
                network,
                deployData.clearingHouseLogic.address,
                [],
                {},
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
                {},
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
                {},
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
                {},
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