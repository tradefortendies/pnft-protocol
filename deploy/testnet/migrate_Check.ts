import { MockContract } from "@eth-optimism/smock"
import { expect } from "chai"
import { BaseContract, BigNumber } from "ethers"
import { formatEther, formatUnits, parseEther, parseUnits } from "ethers/lib/utils"
import { ethers, waffle } from "hardhat"
import { format } from "path"
import {
    AccountBalance,
    BaseToken,
    InsuranceFund,
    MarketRegistry,
    NFTOracle,
    NftPriceFeed,
    TestClearingHouse,
    TestWETH9,
    UniswapV3Pool,
    Vault,
    VirtualToken,
} from "../../typechain"
import {
    b2qExactInput,
    findLiquidityChangedEvents,
    findPnlRealizedEvents,
    findPoolAddedEvents,
    q2bExactOutput,
} from "../../test/helper/clearingHouseHelper"
import { initMarket } from "../../test/helper/marketHelper"
import { getMaxTickRange, IGNORABLE_DUST } from "../../test/helper/number"
import { deposit } from "../../test/helper/token"
import { ClearingHouseFixture, createClearingHouseFixture } from "../../test/clearingHouse/fixtures"

import { encodePriceSqrt, isAscendingTokenOrder } from "../../test/shared/utilities"

import helpers from "../helpers";
const { waitForDeploy, waitForTx, verifyContract } = helpers;

describe("Deployment check", () => {
    const [admin, priceAdmin, platformFund, maker, trader1, trader2, creator] = waffle.provider.getWallets()
    beforeEach(async () => {
    })

    it("check", async () => {
        let deployData = {} as DeployData
        // deployData.priceAdminAddress = priceAdmin.address
        deployData.platformFundAddress = platformFund.address
        deployData.makerFundAddress = maker.address
        deployData.nftPriceFeedBAYC = {
        } as TokenData
        deployData.nftPriceFeedMAYC = {
        } as TokenData
        deployData.wETH = {
            address: '',
            symbol: 'WETH',
            name: 'WETH',
            decimals: 18,
        } as TokenData
        deployData.vETH = {
            symbol: "vETH",
            name: "vETH",
        } as TokenData
        deployData.baseToken = {} as TokenData
        deployData.vBAYC = {
            symbol: "vBAYC",
            name: "vBAYC",
            nftContract: ethers.Wallet.createRandom().address,
        } as TokenData
        deployData.vMAYC = {
            symbol: "vMAYC",
            name: "vMAYC",
            nftContract: ethers.Wallet.createRandom().address,
        } as TokenData
        deployData.uniswapV3Factory = {} as ContractData
        deployData.clearingHouseConfig = {} as ContractData
        deployData.marketRegistry = {} as ContractData
        deployData.accountBalance = {} as ContractData
        deployData.vPool = {} as ContractData
        deployData.insuranceFund = {} as ContractData
        deployData.vault = {} as ContractData
        deployData.uniswapV3Broker = {} as ContractData
        deployData.genericLogic = {} as ContractData
        deployData.clearingHouseLogic = {} as ContractData
        deployData.clearingHouse = {} as ContractData
        deployData.nftOracle = {} as ContractData
        deployData.vBaseToken = {} as ContractData

        let ProxyAdmin = await ethers.getContractFactory('ProxyAdmin');
        const TransparentUpgradeableProxy = await ethers.getContractFactory('TransparentUpgradeableProxy');
        const BaseToken = await ethers.getContractFactory("BaseToken");

        let proxyAdmin = await waitForDeploy(await ProxyAdmin.deploy());
        deployData.proxyAdminAddress = proxyAdmin.address
        {
            const NftPriceFeed = await ethers.getContractFactory("NftPriceFeed")
            const priceFeed = (await waitForDeploy(await NftPriceFeed.deploy('BAYC_ETH'))) as NftPriceFeed
            deployData.nftPriceFeedBAYC.address = priceFeed.address
        }
        {
            const NftPriceFeed = await ethers.getContractFactory("NftPriceFeed")
            const priceFeed = (await waitForDeploy(await NftPriceFeed.deploy('MAYC_ETH'))) as NftPriceFeed
            deployData.nftPriceFeedMAYC.address = priceFeed.address
        }
        {
            const TestWETH9 = await ethers.getContractFactory("TestWETH9")
            const wETH = (await waitForDeploy(await TestWETH9.deploy())) as TestWETH9
            {
                deployData.wETH.address = wETH.address;
            }
        }
        let QuoteToken = await ethers.getContractFactory("QuoteToken");
        if (deployData.vETH.implAddress == undefined || deployData.vETH.implAddress == '') {
            let quoteToken = await waitForDeploy(await QuoteToken.deploy());
            {
                deployData.vETH.implAddress = quoteToken.address;
            }
        }
        {
            var quoteToken = await ethers.getContractAt('QuoteToken', deployData.vETH.implAddress);
            var initializeData = quoteToken.interface.encodeFunctionData('initialize', [deployData.vETH.name, deployData.vETH.symbol]);
            while (true) {
                var transparentUpgradeableProxy = await waitForDeploy(
                    await TransparentUpgradeableProxy.deploy(
                        quoteToken.address,
                        proxyAdmin.address,
                        initializeData,
                    )
                );
                if (deployData.vETH.address == undefined ||
                    deployData.vETH.address == '' ||
                    isAscendingTokenOrder(deployData.vETH.address, transparentUpgradeableProxy.address.toString())) {
                    deployData.vETH.address = transparentUpgradeableProxy.address;
                    if (deployData.vETH.address.toLowerCase().startsWith("0xf")) {
                        console.log('OK vETH')
                        break
                    }
                }
            }
        }
        const vETH = (await ethers.getContractAt('QuoteToken', deployData.vETH.address)) as BaseToken;
        {
            let baseToken = await waitForDeploy(await BaseToken.deploy());
            {
                deployData.baseToken.implAddress = baseToken.address;
            }
        }
        var baseToken = await ethers.getContractAt('BaseToken', deployData.baseToken.implAddress);
        {
            var initializeData = baseToken.interface.encodeFunctionData('initialize', [deployData.vBAYC.name, deployData.vBAYC.symbol, deployData.nftPriceFeedBAYC.address]);
            var transparentUpgradeableProxy: BaseContract
            do {
                transparentUpgradeableProxy = await waitForDeploy(
                    await TransparentUpgradeableProxy.deploy(
                        baseToken.address,
                        proxyAdmin.address,
                        initializeData,
                    )
                ) as BaseContract;
            } while (!isAscendingTokenOrder(transparentUpgradeableProxy.address.toString(), vETH.address))
            {
                deployData.vBAYC.address = transparentUpgradeableProxy.address;
            }
        }
        {
            var initializeData = baseToken.interface.encodeFunctionData('initialize', [deployData.vMAYC.name, deployData.vMAYC.symbol, deployData.nftPriceFeedMAYC.address]);
            var transparentUpgradeableProxy: BaseContract
            do {
                transparentUpgradeableProxy = await waitForDeploy(
                    await TransparentUpgradeableProxy.deploy(
                        baseToken.address,
                        proxyAdmin.address,
                        initializeData,
                    )
                ) as BaseContract;
            } while (!isAscendingTokenOrder(transparentUpgradeableProxy.address.toString(), vETH.address))
            {
                deployData.vMAYC.address = transparentUpgradeableProxy.address;
            }
        }
        const UniswapV3Factory = await ethers.getContractFactory("UniswapV3Factory")
        {
            const uniV3Factory = await waitForDeploy(await UniswapV3Factory.deploy())
            {
                deployData.uniswapV3Factory.address = uniV3Factory.address;
            }
        }
        const UniswapV3Broker = await ethers.getContractFactory("UniswapV3Broker");
        if (deployData.uniswapV3Broker.address == undefined || deployData.uniswapV3Broker.address == '') {
            const uniswapV3Broker = await waitForDeploy(await UniswapV3Broker.deploy())
            {
                deployData.uniswapV3Broker.address = uniswapV3Broker.address;
            }
        }
        const GenericLogic = await ethers.getContractFactory("GenericLogic", {
            libraries: {
                UniswapV3Broker: deployData.uniswapV3Broker.address,
            },
        });
        if (deployData.genericLogic.address == undefined || deployData.genericLogic.address == '') {
            const genericLogic = await waitForDeploy(await GenericLogic.deploy())
            {
                deployData.genericLogic.address = genericLogic.address;
            }
        }
        const ClearingHouseLogic = await ethers.getContractFactory("ClearingHouseLogic", {
            libraries: {
                UniswapV3Broker: deployData.uniswapV3Broker.address,
                GenericLogic: deployData.genericLogic.address,
            },
        });
        {
            const clearingHouseLogic = await waitForDeploy(await ClearingHouseLogic.deploy())
            {
                deployData.clearingHouseLogic.address = clearingHouseLogic.address;
            }
        }

        const ClearingHouseConfig = await ethers.getContractFactory("ClearingHouseConfig");
        {
            const clearingHouseConfig = await waitForDeploy(await ClearingHouseConfig.deploy())
            {
                deployData.clearingHouseConfig.implAddress = clearingHouseConfig.address;
            }
        }
        {
            var clearingHouseConfig = await ethers.getContractAt('ClearingHouseConfig', deployData.clearingHouseConfig.implAddress);
            var initializeData = clearingHouseConfig.interface.encodeFunctionData('initialize', []);
            var transparentUpgradeableProxy = await waitForDeploy(
                await TransparentUpgradeableProxy.deploy(
                    deployData.clearingHouseConfig.implAddress,
                    proxyAdmin.address,
                    initializeData,
                )
            );
            {
                deployData.clearingHouseConfig.address = transparentUpgradeableProxy.address;
            }
        }
        const MarketRegistry = await ethers.getContractFactory("MarketRegistry", {
            libraries: {
                UniswapV3Broker: deployData.uniswapV3Broker.address,
            },
        });
        {
            const marketRegistry = await waitForDeploy(await MarketRegistry.deploy())
            {
                deployData.marketRegistry.implAddress = marketRegistry.address;
            }
        }
        {
            var marketRegistry = await ethers.getContractAt('MarketRegistry', deployData.marketRegistry.implAddress);
            var initializeData = marketRegistry.interface.encodeFunctionData('initialize', [deployData.uniswapV3Factory.address, deployData.vETH.address]);
            var transparentUpgradeableProxy = await waitForDeploy(
                await TransparentUpgradeableProxy.deploy(
                    deployData.marketRegistry.implAddress,
                    proxyAdmin.address,
                    initializeData,
                )
            );
            {
                deployData.marketRegistry.address = transparentUpgradeableProxy.address;
            }
        }
        const AccountBalance = await ethers.getContractFactory("AccountBalance");
        {
            const accountBalance = await waitForDeploy(await AccountBalance.deploy())
            {
                deployData.accountBalance.implAddress = accountBalance.address;
            }
        }
        {
            var accountBalance = await ethers.getContractAt('AccountBalance', deployData.accountBalance.implAddress);
            var initializeData = accountBalance.interface.encodeFunctionData('initialize', [deployData.clearingHouseConfig.address]);
            var transparentUpgradeableProxy = await waitForDeploy(
                await TransparentUpgradeableProxy.deploy(
                    deployData.accountBalance.implAddress,
                    proxyAdmin.address,
                    initializeData,
                )
            );
            {
                deployData.accountBalance.address = transparentUpgradeableProxy.address;
            }
        }
        let VPool = await ethers.getContractFactory("VPool", {
            libraries: {
                UniswapV3Broker: deployData.uniswapV3Broker.address,
                GenericLogic: deployData.genericLogic.address,
                ClearingHouseLogic: deployData.clearingHouseLogic.address,
            },
        });
        if (deployData.vPool.implAddress == undefined || deployData.vPool.implAddress == '') {
            const vPool = await waitForDeploy(await VPool.deploy())
            {
                deployData.vPool.implAddress = vPool.address;
            }
        }
        {
            var vPool = await ethers.getContractAt('VPool', deployData.vPool.implAddress);
            var initializeData = vPool.interface.encodeFunctionData('initialize', [deployData.marketRegistry.address, deployData.clearingHouseConfig.address]);
            var transparentUpgradeableProxy = await waitForDeploy(
                await TransparentUpgradeableProxy.deploy(
                    deployData.vPool.implAddress,
                    proxyAdmin.address,
                    initializeData,
                )
            );
            {
                deployData.vPool.address = transparentUpgradeableProxy.address;
            }
        }
        const InsuranceFund = await ethers.getContractFactory("InsuranceFund");
        {
            const insuranceFund = await waitForDeploy(await InsuranceFund.deploy())
            {
                deployData.insuranceFund.implAddress = insuranceFund.address;
            }
        }
        {
            var insuranceFund = await ethers.getContractAt('InsuranceFund', deployData.insuranceFund.implAddress);
            var initializeData = insuranceFund.interface.encodeFunctionData('initialize', [deployData.wETH.address]);
            var transparentUpgradeableProxy = await waitForDeploy(
                await TransparentUpgradeableProxy.deploy(
                    deployData.insuranceFund.implAddress,
                    proxyAdmin.address,
                    initializeData,
                )
            );
            {
                deployData.insuranceFund.address = transparentUpgradeableProxy.address;
            }
        }
        let Vault = await ethers.getContractFactory("Vault");
        {
            const vault = await waitForDeploy(await Vault.deploy())
            {
                deployData.vault.implAddress = vault.address;
            }
        }
        {
            var vault = await ethers.getContractAt('Vault', deployData.vault.implAddress);
            var initializeData = vault.interface.encodeFunctionData('initialize', [
                deployData.insuranceFund.address,
                deployData.clearingHouseConfig.address,
                deployData.accountBalance.address,
                deployData.vPool.address,
                deployData.makerFundAddress,
            ]);
            var transparentUpgradeableProxy = await waitForDeploy(
                await TransparentUpgradeableProxy.deploy(
                    deployData.vault.implAddress,
                    proxyAdmin.address,
                    initializeData,
                )
            );
            {
                deployData.vault.address = transparentUpgradeableProxy.address;
            }
        }
        let ClearingHouse = await ethers.getContractFactory("ClearingHouse", {
            libraries: {
                UniswapV3Broker: deployData.uniswapV3Broker.address,
                GenericLogic: deployData.genericLogic.address,
                ClearingHouseLogic: deployData.clearingHouseLogic.address,
            },
        });
        {
            const clearingHouse = await waitForDeploy(await ClearingHouse.deploy())
            {
                deployData.clearingHouse.implAddress = clearingHouse.address;
            }
        }
        {
            var clearingHouse = await ethers.getContractAt('ClearingHouse', deployData.clearingHouse.implAddress);
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
            var transparentUpgradeableProxy = await waitForDeploy(
                await TransparentUpgradeableProxy.deploy(
                    deployData.clearingHouse.implAddress,
                    proxyAdmin.address,
                    initializeData,
                )
            );
            {
                deployData.clearingHouse.address = transparentUpgradeableProxy.address;
            }
        }
        {
            const TransparentUpgradeableProxy = await ethers.getContractFactory('TransparentUpgradeableProxy');
            const NFTOracle = await ethers.getContractFactory("NFTOracle");
            if (deployData.nftOracle.implAddress == undefined || deployData.nftOracle.implAddress == '') {
                const nftOracle = await waitForDeploy(await NFTOracle.deploy())
                {
                    deployData.nftOracle.implAddress = nftOracle.address;
                }
            }
            if (deployData.nftOracle.address == undefined || deployData.nftOracle.address == '') {
                let nftOracle = await ethers.getContractAt('NFTOracle', deployData.nftOracle.implAddress);
                var initializeData = nftOracle.interface.encodeFunctionData('initialize', []);
                var transparentUpgradeableProxy = await waitForDeploy(
                    await TransparentUpgradeableProxy.deploy(
                        deployData.nftOracle.implAddress,
                        proxyAdmin.address,
                        initializeData,
                    )
                );
                {
                    deployData.nftOracle.address = transparentUpgradeableProxy.address;
                }
            }
        }
        {
            const VirtualToken = await ethers.getContractFactory("VirtualToken");
            if (deployData.vBaseToken.address == undefined || deployData.vBaseToken.address == '') {
                const vBaseToken = await waitForDeploy(await VirtualToken.deploy())
                {
                    deployData.vBaseToken.address = vBaseToken.address;
                }
            }
        }
        {
            var uniswapV3Factory = await ethers.getContractAt('UniswapV3Factory', deployData.uniswapV3Factory.address);
            var clearingHouseConfig = await ethers.getContractAt('ClearingHouseConfig', deployData.clearingHouseConfig.address);
            var marketRegistry = (await ethers.getContractAt('MarketRegistry', deployData.marketRegistry.address));
            var accountBalance = (await ethers.getContractAt('AccountBalance', deployData.accountBalance.address));
            var vPool = await ethers.getContractAt('VPool', deployData.vPool.address);
            var insuranceFund = await ethers.getContractAt('InsuranceFund', deployData.insuranceFund.address);
            var vault = await ethers.getContractAt('Vault', deployData.vault.address);
            var clearingHouse = await ethers.getContractAt('ClearingHouse', deployData.clearingHouse.address);
            var nftOracle = (await ethers.getContractAt('NFTOracle', deployData.nftOracle.address)) as NFTOracle;

            await waitForTx(await vault.setWETH9(deployData.wETH.address), 'vault.setWETH9(deployData.wETH.address)')

            var uniFeeTier = 3000 // 1%

            await vPool.setAccountBalance(accountBalance.address)
            await insuranceFund.setVault(vault.address)
            await accountBalance.setVault(vault.address)
            await clearingHouseConfig.setSettlementTokenBalanceCap(ethers.constants.MaxUint256)
            await marketRegistry.setClearingHouse(clearingHouse.address)
            await vPool.setClearingHouse(clearingHouse.address)
            await accountBalance.setClearingHouse(clearingHouse.address)
            await vault.setClearingHouse(clearingHouse.address)
            await insuranceFund.setClearingHouse(clearingHouse.address)

            {
                // new update for open protocol
                await nftOracle.setPriceAdmin(priceAdmin.address)
                await marketRegistry.setInsuranceFundFeeRatioGlobal(500)
                await marketRegistry.setPlatformFundFeeRatioGlobal(2000)
                await marketRegistry.setOptimalDeltaTwapRatioGlobal(30000)
                await marketRegistry.setUnhealthyDeltaTwapRatioGlobal(50000)
                await marketRegistry.setOptimalFundingRatioGlobal(250000)
                await marketRegistry.setSharePlatformFeeRatioGlobal(500000)
                await marketRegistry.setMinPoolLiquidityGlobal(parseEther('10'))
                await marketRegistry.setMaxPoolLiquidityGlobal(parseEther('1000000'))
                await vPool.setNftOracle(nftOracle.address)
                await marketRegistry.setVBaseToken(deployData.vBaseToken.address)
                await vETH.setMarketRegistry(marketRegistry.address)
                await vault.setMarketRegistry(marketRegistry.address)
                await accountBalance.setMarketRegistry(marketRegistry.address)
                await insuranceFund.setMarketRegistry(marketRegistry.address)
            }

        //     const vBAYC = await ethers.getContractAt('BaseToken', deployData.vBAYC.address);
        //     {
        //         await uniswapV3Factory.createPool(deployData.vBAYC.address, deployData.vETH.address, uniFeeTier)
        //         const poolBAYCAddr = await uniswapV3Factory.getPool(vBAYC.address, vETH.address, uniFeeTier)
        //         const poolBAYC = await ethers.getContractAt('UniswapV3Pool', poolBAYCAddr);
        //         await vBAYC.addWhitelist(poolBAYC.address)
        //         await vETH.addWhitelist(poolBAYC.address)
        //     }

        //     const vMAYC = await ethers.getContractAt('BaseToken', deployData.vMAYC.address);
        //     {
        //         await uniswapV3Factory.createPool(deployData.vMAYC.address, deployData.vETH.address, uniFeeTier)
        //         const poolMAYCAddr = await uniswapV3Factory.getPool(vMAYC.address, vETH.address, uniFeeTier)
        //         const poolMAYC = await ethers.getContractAt('UniswapV3Pool', poolMAYCAddr);
        //         await vMAYC.addWhitelist(poolMAYC.address)
        //         await vETH.addWhitelist(poolMAYC.address)
        //     }

        //     // deploy clearingHouse
            await vETH.addWhitelist(clearingHouse.address)
        //     await vBAYC.addWhitelist(clearingHouse.address)
        //     await vMAYC.addWhitelist(clearingHouse.address)

            await vETH.mintMaximumTo(clearingHouse.address)
        //     await vBAYC.mintMaximumTo(clearingHouse.address)
        //     await vMAYC.mintMaximumTo(clearingHouse.address)

        //     // initMarket
        //     var maxTickCrossedWithinBlock: number = getMaxTickRange()
        //     // vBAYC
        //     {
        //         const poolAddr = await uniswapV3Factory.getPool(vBAYC.address, vETH.address, uniFeeTier)
        //         const uniPool = await ethers.getContractAt('UniswapV3Pool', poolAddr);
        //         await uniPool.initialize(encodePriceSqrt('1', "1"))
        //         const uniFeeRatio = await uniPool.fee()
        //         await marketRegistry.addPool(vBAYC.address, uniFeeRatio)
        //         await vPool.setMaxTickCrossedWithinBlock(vBAYC.address, maxTickCrossedWithinBlock)
        //     }
        //     // vMAYC
        //     {
        //         const poolAddr = await uniswapV3Factory.getPool(vMAYC.address, vETH.address, uniFeeTier)
        //         const uniPool = await ethers.getContractAt('UniswapV3Pool', poolAddr);
        //         await uniPool.initialize(encodePriceSqrt('1', "1"))
        //         const uniFeeRatio = await uniPool.fee()
        //         await marketRegistry.addPool(vMAYC.address, uniFeeRatio)
        //         await vPool.setMaxTickCrossedWithinBlock(vMAYC.address, maxTickCrossedWithinBlock)

        //     }
        }
        // {
        //     await marketRegistry.setNftContract(deployData.vBAYC.address, deployData.vMAYC.nftContract)
        //     await marketRegistry.setNftContract(deployData.vMAYC.address, deployData.vMAYC.nftContract)
        // }

        var vIsolatedToken: VirtualToken
        var vNftAddress = ethers.Wallet.createRandom().address
        {
            let r = await (
                await marketRegistry.connect(maker).createIsolatedPool(vNftAddress, 'TEST', encodePriceSqrt('1', "1"), parseEther('10000'))
            ).wait()
            let log = await findPoolAddedEvents(marketRegistry as MarketRegistry, r)[0]
            vIsolatedToken = (await ethers.getContractAt('VirtualToken', log.args.baseToken)) as VirtualToken;
        }
        {
            // deploy UniV3 factory
            var uniswapV3Factory = await ethers.getContractAt('UniswapV3Factory', deployData.uniswapV3Factory.address);
            var clearingHouseConfig = await ethers.getContractAt('ClearingHouseConfig', deployData.clearingHouseConfig.address);
            var marketRegistry = (await ethers.getContractAt('MarketRegistry', deployData.marketRegistry.address));
            var accountBalance = (await ethers.getContractAt('AccountBalance', deployData.accountBalance.address));
            var vPool = await ethers.getContractAt('VPool', deployData.vPool.address);
            var insuranceFund = await ethers.getContractAt('InsuranceFund', deployData.insuranceFund.address);
            var vault = await ethers.getContractAt('Vault', deployData.vault.address);
            var clearingHouse = await ethers.getContractAt('ClearingHouse', deployData.clearingHouse.address);

            var wETH = (await ethers.getContractAt('TestWETH9', deployData.wETH.address)) as TestWETH9;
            const vBAYC = (await ethers.getContractAt('VirtualToken', deployData.vBAYC.address)) as VirtualToken;
            const vMAYC = (await ethers.getContractAt('VirtualToken', deployData.vMAYC.address)) as VirtualToken;
            const vBTkn = (await ethers.getContractAt('VirtualToken', vIsolatedToken.address)) as VirtualToken;

            {
                await waitForTx(
                    await nftOracle.connect(priceAdmin).setNftPrice(deployData.vBAYC.nftContract, parseEther('1'))
                )
                await waitForTx(
                    await nftOracle.connect(priceAdmin).setNftPrice(deployData.vMAYC.nftContract, parseEther('1'))
                )
                await waitForTx(
                    await nftOracle.connect(priceAdmin).setNftPrice(vNftAddress, parseEther('1'))
                )
            }

            // for (var token of [vBAYC, vMAYC]) {
            //     {
            //         await waitForTx(
            //             await vault.connect(trader1).depositEther(token.address, { value: parseEther('10') })
            //         )
            //     }
            //     {
            //         await waitForTx(
            //             await vault.connect(trader2).depositEther(token.address, { value: parseEther('10') })
            //         )
            //     }
            //     {
            //         await waitForTx(
            //             await clearingHouse.connect(maker).addLiquidity({
            //                 baseToken: token.address,
            //                 liquidity: parseEther('10000'),
            //                 deadline: ethers.constants.MaxUint256,
            //             }),
            //             'clearingHouse.connect(maker).addLiquidity'
            //         )
            //     }
            //     {
            //         await waitForTx(
            //             await clearingHouse.connect(trader1).openPosition({
            //                 baseToken: token.address,
            //                 isBaseToQuote: true,
            //                 isExactInput: false,
            //                 oppositeAmountBound: 0,
            //                 amount: parseEther("1"),
            //                 sqrtPriceLimitX96: 0,
            //                 deadline: ethers.constants.MaxUint256,
            //                 referralCode: ethers.constants.HashZero,
            //             }),
            //             'clearingHouse.connect(trader1).openPosition'
            //         )
            //     }
            //     {
            //         await waitForTx(
            //             await clearingHouse.connect(trader2).openPosition({
            //                 baseToken: token.address,
            //                 isBaseToQuote: false,
            //                 isExactInput: false,
            //                 oppositeAmountBound: ethers.constants.MaxUint256,
            //                 amount: parseEther("0.5"),
            //                 sqrtPriceLimitX96: 0,
            //                 deadline: ethers.constants.MaxUint256,
            //                 referralCode: ethers.constants.HashZero,
            //             }),
            //             'clearingHouse.connect(trader2).openPosition'
            //         )
            //     }
            //     {
            //         await waitForTx(
            //             await clearingHouse.connect(maker).removeLiquidity({
            //                 baseToken: token.address,
            //                 liquidity: parseEther("5000"),
            //                 deadline: ethers.constants.MaxUint256,
            //             }),
            //             'clearingHouse.connect(maker).removeLiquidity'
            //         )
            //     }
            //     {
            //         await waitForTx(
            //             await clearingHouse.connect(trader1).closePosition({
            //                 baseToken: token.address,
            //                 sqrtPriceLimitX96: parseEther("0"),
            //                 oppositeAmountBound: parseEther("0"),
            //                 deadline: ethers.constants.MaxUint256,
            //                 referralCode: ethers.constants.HashZero,
            //             }),
            //             'clearingHouse.connect(trader1).closePosition'
            //         )
            //     }
            //     {
            //         await waitForTx(
            //             await clearingHouse.connect(trader2).closePosition({
            //                 baseToken: token.address,
            //                 sqrtPriceLimitX96: parseEther("0"),
            //                 oppositeAmountBound: parseEther("0"),
            //                 deadline: ethers.constants.MaxUint256,
            //                 referralCode: ethers.constants.HashZero,
            //             }),
            //             'clearingHouse.connect(trader2).closePosition'
            //         )
            //     }
            //     // {
            //     //     await waitForTx(
            //     //         await clearingHouse.connect(maker).removeLiquidity({
            //     //             baseToken: token.address,
            //     //             liquidity: parseEther("5000"),
            //     //             deadline: ethers.constants.MaxUint256,
            //     //         }),
            //     //         'clearingHouse.connect(maker).removeLiquidity'
            //     //     )
            //     // }
            // }

            // 
            for (var token of [vBTkn]) {
                {
                    await waitForTx(
                        await clearingHouse.connect(maker).addLiquidity({
                            baseToken: token.address,
                            liquidity: parseEther('10000'),
                            deadline: ethers.constants.MaxUint256,
                        }),
                        'clearingHouse.connect(maker).addLiquidity'
                    )
                }

                {
                    await waitForTx(
                        await clearingHouse.connect(trader1).depositEtherAndOpenPosition({
                            baseToken: token.address,
                            isBaseToQuote: true,
                            isExactInput: true,
                            oppositeAmountBound: 0,
                            amount: parseEther("1"),
                            sqrtPriceLimitX96: 0,
                            deadline: ethers.constants.MaxUint256,
                            referralCode: ethers.constants.HashZero,
                        },
                            { value: parseEther('0.2025') }
                        ),
                        'clearingHouse.connect(trader1).openPosition'
                    )
                }
                {
                    await waitForTx(
                        await clearingHouse.connect(trader2).depositEtherAndOpenPosition({
                            baseToken: token.address,
                            isBaseToQuote: false,
                            isExactInput: false,
                            oppositeAmountBound: ethers.constants.MaxUint256,
                            amount: parseEther("0.5"),
                            sqrtPriceLimitX96: 0,
                            deadline: ethers.constants.MaxUint256,
                            referralCode: ethers.constants.HashZero,
                        },
                            { value: parseEther('0.2025') }
                        ),
                        'clearingHouse.connect(trader2).openPosition'
                    )
                }
                {
                    await waitForTx(
                        await clearingHouse.connect(maker).removeLiquidity({
                            baseToken: token.address,
                            liquidity: parseEther("5000"),
                            deadline: ethers.constants.MaxUint256,
                        }),
                        'clearingHouse.connect(maker).removeLiquidity'
                    )
                }
                {
                    await waitForTx(
                        await clearingHouse.connect(trader1).closePosition({
                            baseToken: token.address,
                            sqrtPriceLimitX96: parseEther("0"),
                            oppositeAmountBound: parseEther("0"),
                            deadline: ethers.constants.MaxUint256,
                            referralCode: ethers.constants.HashZero,
                        }),
                        'clearingHouse.connect(trader1).closePosition'
                    )
                }
                {
                    await waitForTx(
                        await clearingHouse.connect(trader2).closePosition({
                            baseToken: token.address,
                            sqrtPriceLimitX96: parseEther("0"),
                            oppositeAmountBound: parseEther("0"),
                            deadline: ethers.constants.MaxUint256,
                            referralCode: ethers.constants.HashZero,
                        }),
                        'clearingHouse.connect(trader2).closePosition'
                    )
                }
                // {
                //     await waitForTx(
                //         await clearingHouse.connect(maker).removeLiquidity({
                //             baseToken: token.address,
                //             liquidity: parseEther("5000"),
                //             deadline: ethers.constants.MaxUint256,
                //         }),
                //         'clearingHouse.connect(maker).removeLiquidity'
                //     )
                // }
            }
        }
    })
})
