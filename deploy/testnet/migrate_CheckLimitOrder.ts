import fs from "fs";

import bn from "bignumber.js"

import hre, { ethers } from "hardhat";

import { encodePriceSqrt, formatSqrtPriceX96ToPrice } from "../../test/shared/utilities";
import { AccountBalance, BaseToken, ClearingHouse, ClearingHouseConfig, VPool, GenericLogic, InsuranceFund, MarketRegistry, MockPNFTToken, NftPriceFeed, QuoteToken, RewardMiner, TestERC20, TestFaucet, UniswapV3Pool, Vault, LimitOrderBook } from "../../typechain";
import { getMaxTickRange, priceToTick } from "../../test/helper/number";
import helpers from "../helpers";
import { formatEther, parseEther, parseUnits } from "ethers/lib/utils";
const { waitForTx, tryWaitForTx, loadDB, saveDB } = helpers;

import migrateAdmin from "./1_migrate_Admin";
import migratePriceFeedAll from "./2_migrate_PriceFeed_All";
import migrateTokens from "./3_migrate_Tokens";
import migrateQuoteToken from "./4_migrate_QuoteToken";
import migrateBaseTokenAll from "./5_migrate_BaseToken_All";
import migrateLibrary from "./6_migrate_Library";
import migrateUniswapV3 from "./6_migrate_UniswapV3";
import migrateClearingHouseConfig from "./7_migrate_ClearingHouseConfig";
import migrateMarketRegistry from "./8_migrate_MarketRegistry";
import migrateAccountBalance from "./10_migrate_AccountBalance";
import migrateVPool from "./11_migrate_VPool";
import migrateInsuranceFund from "./12_migrate_InsuranceFund";
import migrateVault from "./13_migrate_Vault";
import migrateClearingHouse from "./15_migrate_ClearingHouse";
import migratePNFTToken from "./20_migrate_PNFTToken";
import migrateRewardMiner from "./21_migrate_RewardMiner";
import migrate_ReferralPayment from "./22_migrate_ReferralPayment";
import migrate_LimitOrderBook from "./23_migrate_LimitOrderBook";
import { } from "../../test/helper/clearingHouseHelper";
import { BigNumber, providers } from "ethers";
import {
    signTypedData, SignTypedDataVersion, TypedMessage,
} from "@metamask/eth-sig-util";


const TRADER1_KEY = process.env.TRADER1_KEY ?? '';
const TRADER2_KEY = process.env.TRADER2_KEY ?? '';
const TRADER3_KEY = process.env.TRADER3_KEY ?? '';
const TRADER4_KEY = process.env.TRADER4_KEY ?? '';


async function main() {
    await deploy();
}

export default deploy;

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function deploy() {

    console.log('START')

    // {
    //     console.log('migrateAdmin -- START --')
    //     await migrateAdmin();
    //     console.log('migrateAdmin -- END --')
    // }

    // {
    //     console.log('migratePriceFeedAll -- START --')
    //     await migratePriceFeedAll();
    //     console.log('migratePriceFeedAll -- END --')
    // }

    // // import migrateTokens from "./3_migrate_Tokens";
    // {
    //     console.log('migrateTokens -- START --')
    //     await migrateTokens();
    //     console.log('migrateTokens -- END --')
    // }

    // // import migrateQuoteToken from "./4_migrate_QuoteToken";
    // {
    //     console.log('migrateQuoteToken -- START --')
    //     await migrateQuoteToken();
    //     console.log('migrateQuoteToken -- END --')
    // }

    // // import migrateBaseTokenAll from "./5_migrate_BaseToken_All";
    // {
    //     console.log('migrateBaseTokenAll -- START --')
    //     await migrateBaseTokenAll();
    //     console.log('migrateBaseTokenAll -- END --')
    // }

    // // import migrateLibrary from "./6_migrate_Library";
    // {
    //     console.log('migrateLibrary -- START --')
    //     await migrateLibrary();
    //     console.log('migrateLibrary -- END --')
    // }

    // // import migrateUniswapV3 from "./6_migrate_UniswapV3";
    // {
    //     console.log('migrateUniswapV3 -- START --')
    //     await migrateUniswapV3();
    //     console.log('migrateUniswapV3 -- END --')
    // }

    // // import migrateClearingHouseConfig from "./7_migrate_ClearingHouseConfig";
    // {
    //     console.log('migrateClearingHouseConfig -- START --')
    //     await migrateClearingHouseConfig();
    //     console.log('migrateClearingHouseConfig -- END --')
    // }

    // // import migrateMarketRegistry from "./8_migrate_MarketRegistry";
    // {
    //     console.log('migrateMarketRegistry -- START --')
    //     await migrateMarketRegistry();
    //     console.log('migrateMarketRegistry -- END --')
    // }

    // // import migrateAccountBalance from "./10_migrate_AccountBalance";
    // {
    //     console.log('migrateAccountBalance -- START --')
    //     await migrateAccountBalance();
    //     console.log('migrateAccountBalance -- END --')
    // }

    // // import migrateVPool from "./11_migrate_VPool";
    // {
    //     console.log('migrateVPool -- START --')
    //     await migrateVPool();
    //     console.log('migrateVPool -- END --')
    // }

    // // import migrateInsuranceFund from "./12_migrate_InsuranceFund";
    // {
    //     console.log('migrateInsuranceFund -- START --')
    //     await migrateInsuranceFund();
    //     console.log('migrateInsuranceFund -- END --')
    // }

    // // import migrateVault from "./13_migrate_Vault";
    // {
    //     console.log('migrateVault -- START --')
    //     await migrateVault();
    //     console.log('migrateVault -- END --')
    // }

    // // import migrateClearingHouse from "./15_migrate_ClearingHouse";
    // {
    //     console.log('migrateClearingHouse -- START --')
    //     await migrateClearingHouse();
    //     console.log('migrateClearingHouse -- END --')
    // }

    // // import migratePNFTToken from "./20_migrate_PNFTToken";
    // {
    //     console.log('migratePNFTToken -- START --')
    //     await migratePNFTToken();
    //     console.log('migratePNFTToken -- END --')
    // }

    // // import migrateRewardMiner from "./21_migrate_RewardMiner";
    // {
    //     console.log('migrateRewardMiner -- START --')
    //     await migrateRewardMiner();
    //     console.log('migrateRewardMiner -- END --')
    // }

    // // import migrate_ReferralPayment from "./22_migrate_ReferralPayment";
    // {
    //     console.log('migrate_ReferralPayment -- START --')
    //     await migrate_ReferralPayment();
    //     console.log('migrate_ReferralPayment -- END --')
    // }

    // await delay(0)
    // // import migrate_LimitOrderBook from "./23_migrate_LimitOrderBook";
    // {
    //     console.log('migrate_LimitOrderBook -- START --')
    //     await migrate_LimitOrderBook();
    //     console.log('migrate_LimitOrderBook -- END --')
    // }

    // return


    const network = hre.network.name;
    let deployData = (await loadDB(network))
    let priceData: PriceData;
    {
        let dataText = await fs.readFileSync(process.cwd() + '/deploy/testnet/address/prices.json')
        priceData = JSON.parse(dataText.toString())
    }

    const [admin, maker, priceAdmin, platformFund, trader1, trader2, trader3, trader4, hieuq] = await ethers.getSigners()

    // deploy UniV3 factory
    var genericLogic = (await hre.ethers.getContractAt('GenericLogic', deployData.genericLogic.address)) as GenericLogic;
    var clearingHouseConfig = (await hre.ethers.getContractAt('ClearingHouseConfig', deployData.clearingHouseConfig.address)) as ClearingHouseConfig;
    var marketRegistry = (await hre.ethers.getContractAt('MarketRegistry', deployData.marketRegistry.address)) as MarketRegistry;
    var accountBalance = (await hre.ethers.getContractAt('AccountBalance', deployData.accountBalance.address)) as AccountBalance;
    var vPool = (await hre.ethers.getContractAt('VPool', deployData.vPool.address) as VPool);
    var insuranceFund = (await hre.ethers.getContractAt('InsuranceFund', deployData.insuranceFund.address)) as InsuranceFund;
    var vault = (await hre.ethers.getContractAt('Vault', deployData.vault.address)) as Vault;
    var clearingHouse = (await hre.ethers.getContractAt('ClearingHouse', deployData.clearingHouse.address)) as ClearingHouse;
    var rewardMiner = (await hre.ethers.getContractAt('RewardMiner', deployData.rewardMiner.address)) as RewardMiner;
    var pNFTToken = (await hre.ethers.getContractAt('MockPNFTToken', deployData.pNFTToken.address)) as MockPNFTToken;
    var testFaucet = (await hre.ethers.getContractAt('TestFaucet', deployData.testFaucet.address)) as TestFaucet;
    var wETH = (await hre.ethers.getContractAt('TestERC20', deployData.wETH.address)) as TestERC20;

    var limitOrderBook = (await hre.ethers.getContractAt('LimitOrderBook', deployData.limitOrderBook.address)) as LimitOrderBook;

    {
        // console.log(
        //     await limitOrderBook.getOrderStatus(ethers.utils.arrayify('0x0f840285b07371ae8c82a81aa9f21dd9fdeb6c04615f7d4e048884d897eb2483'))
        // )

        let multiplier = await accountBalance.getMarketMultiplier(deployData.vBAYC.address)
        let fillOrderParams = {
            multiplier: multiplier.longMultiplier.add(multiplier.shortMultiplier).toString(),
            orderType: '0',
            nonce: ethers.BigNumber.from(ethers.utils.randomBytes(32)).toString(),
            trader: trader1.address,
            baseToken: deployData.vBAYC.address,
            isBaseToQuote: false,
            isExactInput: true,
            amount: parseEther('0.15').toString(),
            oppositeAmountBound: parseUnits('0', 0).toString(),
            deadline: 2000000000,
            triggerPrice: parseUnits('70', 18).toString(),
            takeProfitPrice: parseUnits("70.1", 18).toString(),
            stopLossPrice: parseUnits("0", 18).toString(),
        }

        const { chainId } = await ethers.provider.getNetwork()

        const typedData: TypedMessage<any> = {
            types: {
                EIP712Domain: [
                    { name: "name", type: "string" },
                    { name: "version", type: "string" },
                    { name: "chainId", type: "uint256" },
                    { name: "verifyingContract", type: "address" },
                ],
                LimitOrderParams: [
                    { name: "multiplier", type: "uint256" },
                    { name: "orderType", type: "uint8" },
                    { name: "nonce", type: "uint256" },
                    { name: "trader", type: "address" },
                    { name: "baseToken", type: "address" },
                    { name: "isBaseToQuote", type: "bool" },
                    { name: "isExactInput", type: "bool" },
                    { name: "amount", type: "uint256" },
                    { name: "oppositeAmountBound", type: "uint256" },
                    { name: "deadline", type: "uint256" },
                    { name: "triggerPrice", type: "uint256" },
                    { name: "takeProfitPrice", type: "uint256" },
                    { name: "stopLossPrice", type: "uint256" },
                ]
            },
            primaryType: "LimitOrderParams",
            domain: {
                name: "pNFT LimitOrderBook",
                version: "1.0",
                chainId: chainId,
                verifyingContract: limitOrderBook.address,
            },
            message: fillOrderParams
        };

        const privateKey = Buffer.from(
            TRADER1_KEY.substring(2),
            "hex"
        );

        const signature = signTypedData({
            privateKey,
            data: typedData,
            version: SignTypedDataVersion.V4,
        });

        console.log(
            JSON.stringify({
                pair_id: 1,
                order_type: 'limit_order',
                multiplier: formatEther(fillOrderParams.multiplier),
                nonce: fillOrderParams.nonce,
                is_base_to_quote: fillOrderParams.isBaseToQuote,
                is_exact_input: fillOrderParams.isExactInput,
                amount: formatEther(fillOrderParams.amount),
                opposite_amount_bound: formatEther(fillOrderParams.oppositeAmountBound),
                deadline: fillOrderParams.deadline,
                trigger_price: formatEther(fillOrderParams.triggerPrice),
                take_profit_price: formatEther(fillOrderParams.takeProfitPrice),
                stop_loss_price: formatEther(fillOrderParams.stopLossPrice),
                signature_hex: signature,
            },
                null,
                4,
            )
        )
        // await waitForTx(
        //     await limitOrderBook.connect(platformFund).fillLimitOrder(fillOrderParams, ethers.utils.arrayify(signature))
        // )
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});