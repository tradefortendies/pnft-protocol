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
import migratePriceFeedAll from "./2_migrate_PriceFeed_All";
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
        await verifyContract(
            deployData,
            network,
            deployData.proxyAdminAddress,
            [],
            {},
            "@openzeppelin/contracts/proxy/ProxyAdmin.sol:ProxyAdmin",
        )
    }
    {
        let nftPriceFeeds = [
            deployData.nftPriceFeedBAYC,
            deployData.nftPriceFeedCRYPTOPUNKS,
            deployData.nftPriceFeedAZUKI,
        ];
        for (let i = 0; i < nftPriceFeeds.length; i++) {
            var nftPriceFeed = nftPriceFeeds[i]
            {
                await verifyContract(
                    deployData,
                    network,
                    nftPriceFeed.address,
                    [nftPriceFeed.symbol],
                    {},
                    "contracts/oracle/NftPriceFeed.sol:NftPriceFeed",
                )
            }
        }
    }
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
        {
            var quoteToken = await hre.ethers.getContractAt('QuoteToken', deployData.vETH.implAddress);
            var initializeData = quoteToken.interface.encodeFunctionData('initialize', [deployData.vETH.name, deployData.vETH.symbol]);
            await verifyContract(
                deployData,
                network,
                deployData.vETH.address,
                [
                    deployData.vETH.implAddress,
                    deployData.proxyAdminAddress,
                    initializeData,
                ],
                {},
                "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy",
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
        var baseToken = await hre.ethers.getContractAt('BaseToken', deployData.baseToken.implAddress);
        let baseTokens = [
            deployData.vBAYC,
            deployData.vCRYPTOPUNKS,
            deployData.vAZUKI,
        ];
        let nftPriceFeeds = [
            deployData.nftPriceFeedBAYC,
            deployData.nftPriceFeedCRYPTOPUNKS,
            deployData.nftPriceFeedAZUKI,
        ];
        for (let i = 0; i < baseTokens.length; i++) {
            var baseVToken = baseTokens[i]
            var nftPriceFeed = nftPriceFeeds[i]
            {
                var initializeData = baseToken.interface.encodeFunctionData('initialize', [baseVToken.name, baseVToken.symbol, nftPriceFeed.address]);
                await verifyContract(
                    deployData,
                    network,
                    baseVToken.address,
                    [
                        baseToken.address,
                        deployData.proxyAdminAddress,
                        initializeData,
                    ],
                    {},
                    "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy",
                )
            }
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
                {
                    UniswapV3Broker: deployData.uniswapV3Broker.address,
                },
                "contracts/lib/GenericLogic.sol:GenericLogic",
            )
        }
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
        {
            var clearingHouseConfig = await hre.ethers.getContractAt('ClearingHouseConfig', deployData.clearingHouseConfig.implAddress);
            var initializeData = clearingHouseConfig.interface.encodeFunctionData('initialize', []);
            await verifyContract(
                deployData,
                network,
                deployData.clearingHouseConfig.address,
                [
                    deployData.clearingHouseConfig.implAddress,
                    deployData.proxyAdminAddress,
                    initializeData,
                ],
                {},
                "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy",
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
        {
            var marketRegistry = await hre.ethers.getContractAt('MarketRegistry', deployData.marketRegistry.implAddress);
            var initializeData = marketRegistry.interface.encodeFunctionData('initialize', [deployData.uniswapV3Factory.address, deployData.vETH.address]);
            await verifyContract(
                deployData,
                network,
                deployData.marketRegistry.address,
                [
                    deployData.marketRegistry.implAddress,
                    deployData.proxyAdminAddress,
                    initializeData,
                ],
                {},
                "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy",
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
        {
            var accountBalance = await hre.ethers.getContractAt('AccountBalance', deployData.accountBalance.implAddress);
            var initializeData = accountBalance.interface.encodeFunctionData('initialize', [deployData.clearingHouseConfig.address]);
            await verifyContract(
                deployData,
                network,
                deployData.accountBalance.address,
                [
                    deployData.accountBalance.implAddress,
                    deployData.proxyAdminAddress,
                    initializeData,
                ],
                {},
                "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy",
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
        {
            var vPool = await hre.ethers.getContractAt('VPool', deployData.vPool.implAddress);
            var initializeData = vPool.interface.encodeFunctionData('initialize', [deployData.marketRegistry.address, deployData.clearingHouseConfig.address]);
            await verifyContract(
                deployData,
                network,
                deployData.vPool.address,
                [
                    deployData.vPool.implAddress,
                    deployData.proxyAdminAddress,
                    initializeData,
                ],
                {},
                "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy",
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
        {
            var insuranceFund = await hre.ethers.getContractAt('InsuranceFund', deployData.insuranceFund.implAddress);
            var initializeData = insuranceFund.interface.encodeFunctionData('initialize', [deployData.wETH.address]);
            await verifyContract(
                deployData,
                network,
                deployData.insuranceFund.address,
                [
                    deployData.insuranceFund.implAddress,
                    deployData.proxyAdminAddress,
                    initializeData,
                ],
                {},
                "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy",
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
        {
            var vault = await hre.ethers.getContractAt('Vault', deployData.vault.implAddress);
            var initializeData = vault.interface.encodeFunctionData('initialize', [
                deployData.insuranceFund.address,
                deployData.clearingHouseConfig.address,
                deployData.accountBalance.address,
                deployData.vPool.address,
                deployData.makerFundAddress,
            ]);
            await verifyContract(
                deployData,
                network,
                deployData.vault.address,
                [
                    deployData.vault.implAddress,
                    deployData.proxyAdminAddress,
                    initializeData,
                ],
                {},
                "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy",
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
        {
            var clearingHouse = await hre.ethers.getContractAt('ClearingHouse', deployData.clearingHouse.implAddress);
            var initializeData = clearingHouse.interface.encodeFunctionData('initialize', [
                deployData.clearingHouseConfig.address,
                deployData.vault.address,
                deployData.vETH.address,
                deployData.uniswapV3Factory.address,
                deployData.vPool.address,
                deployData.accountBalance.address,
                deployData.marketRegistry.address,
                deployData.insuranceFund.address,
                deployData.platformFundAddress,
                deployData.makerFundAddress,
            ]);
            await verifyContract(
                deployData,
                network,
                deployData.clearingHouse.address,
                [
                    deployData.clearingHouse.implAddress,
                    deployData.proxyAdminAddress,
                    initializeData,
                ],
                {},
                "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy",
            )
        }
    }
    {
        {
            await verifyContract(
                deployData,
                network,
                deployData.pNFTToken.implAddress,
                [],
                {},
                "contracts/token/PNFTToken.sol:PNFTToken",
            )
        }
        {
            var pNFTToken = await hre.ethers.getContractAt('PNFTToken', deployData.pNFTToken.implAddress);
            var initializeData = pNFTToken.interface.encodeFunctionData('initialize', [
                deployData.pNFTToken.name,
                deployData.pNFTToken.symbol,
            ]);
            await verifyContract(
                deployData,
                network,
                deployData.pNFTToken.address,
                [
                    deployData.pNFTToken.implAddress,
                    deployData.proxyAdminAddress,
                    initializeData,
                ],
                {},
                "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy",
            )
        }
    }
    {
        {
            await verifyContract(
                deployData,
                network,
                deployData.rewardMiner.implAddress,
                [],
                {},
                "contracts/RewardMiner.sol:RewardMiner",
            )
        }
        let periodDuration = 43200; // 12h
        const starts = [
            1,
            361,
            721,
            1081,
            1441,
            1801,
            2161,
            2521,
            2881,
            3241,
            3601,
        ]
        const ends = [
            360,
            720,
            1080,
            1440,
            1800,
            2160,
            2520,
            2880,
            3240,
            3600,
            3960,
        ]
        const totals = [
            parseEther('25000.00'),
            parseEther('22500.00'),
            parseEther('20250.00'),
            parseEther('18225.00'),
            parseEther('16402.50'),
            parseEther('14762.25'),
            parseEther('13286.03'),
            parseEther('11957.42'),
            parseEther('10761.68'),
            parseEther('9685.51'),
            parseEther('3836.28'),
        ]
        const initData = [
            deployData.clearingHouse.address,
            deployData.pNFTToken.address,
            periodDuration,
            starts,
            ends,
            totals,
            360,
        ]
        {
            var rewardMiner = await hre.ethers.getContractAt('RewardMiner', deployData.rewardMiner.implAddress);
            var initializeData = rewardMiner.interface.encodeFunctionData('initialize', initData);
            await verifyContract(
                deployData,
                network,
                deployData.rewardMiner.address,
                [
                    deployData.rewardMiner.implAddress,
                    deployData.proxyAdminAddress,
                    initializeData,
                ],
                {},
                "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy",
            )
        }
    }

    console.log('END')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});