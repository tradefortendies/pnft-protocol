import fs from "fs";

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
import migrate_LimitOrderBook from "./23_migrate_LimitOrderBook";
import migrate_NFTOracle from "./24_migrate_NFTOracle";
import migrate_VBaseToken from "./25_migrate_VBaseToken";

async function main() {
    await deploy();
}

export default deploy;

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function deploy() {
    {
        console.log('migrateAdmin -- START --')
        await migrateAdmin();
        console.log('migrateAdmin -- END --')
    }
    await delay(0)
    {
        console.log('migratePriceFeedAll -- START --')
        await migratePriceFeedAll();
        console.log('migratePriceFeedAll -- END --')
    }
    await delay(0)
    // import migrateTokens from "./3_migrate_Tokens";
    {
        console.log('migrateTokens -- START --')
        await migrateTokens();
        console.log('migrateTokens -- END --')
    }
    await delay(0)
    // import migrateQuoteToken from "./4_migrate_QuoteToken";
    {
        console.log('migrateQuoteToken -- START --')
        await migrateQuoteToken();
        console.log('migrateQuoteToken -- END --')
    }
    await delay(0)
    // import migrateBaseTokenAll from "./5_migrate_BaseToken_All";
    {
        console.log('migrateBaseTokenAll -- START --')
        await migrateBaseTokenAll();
        console.log('migrateBaseTokenAll -- END --')
    }
    await delay(0)
    // import migrateLibrary from "./6_migrate_Library";
    {
        console.log('migrateLibrary -- START --')
        await migrateLibrary();
        console.log('migrateLibrary -- END --')
    }
    await delay(0)
    // import migrateUniswapV3 from "./6_migrate_UniswapV3";
    {
        console.log('migrateUniswapV3 -- START --')
        await migrateUniswapV3();
        console.log('migrateUniswapV3 -- END --')
    }
    await delay(0)
    // import migrateClearingHouseConfig from "./7_migrate_ClearingHouseConfig";
    {
        console.log('migrateClearingHouseConfig -- START --')
        await migrateClearingHouseConfig();
        console.log('migrateClearingHouseConfig -- END --')
    }
    await delay(0)
    // import migrateMarketRegistry from "./8_migrate_MarketRegistry";
    {
        console.log('migrateMarketRegistry -- START --')
        await migrateMarketRegistry();
        console.log('migrateMarketRegistry -- END --')
    }
    await delay(0)
    // import migrateAccountBalance from "./10_migrate_AccountBalance";
    {
        console.log('migrateAccountBalance -- START --')
        await migrateAccountBalance();
        console.log('migrateAccountBalance -- END --')
    }
    await delay(0)
    // import migrateVPool from "./11_migrate_VPool";
    {
        console.log('migrateVPool -- START --')
        await migrateVPool();
        console.log('migrateVPool -- END --')
    }
    await delay(0)
    // import migrateInsuranceFund from "./12_migrate_InsuranceFund";
    {
        console.log('migrateInsuranceFund -- START --')
        await migrateInsuranceFund();
        console.log('migrateInsuranceFund -- END --')
    }
    await delay(0)
    // import migrateVault from "./13_migrate_Vault";
    {
        console.log('migrateVault -- START --')
        await migrateVault();
        console.log('migrateVault -- END --')
    }
    await delay(0)
    // import migrateClearingHouse from "./15_migrate_ClearingHouse";
    {
        console.log('migrateClearingHouse -- START --')
        await migrateClearingHouse();
        console.log('migrateClearingHouse -- END --')
    }
    await delay(0)
    // import migratePNFTToken from "./20_migrate_PNFTToken";
    {
        console.log('migratePNFTToken -- START --')
        await migratePNFTToken();
        console.log('migratePNFTToken -- END --')
    }
    await delay(0)
    // import migrateRewardMiner from "./21_migrate_RewardMiner";
    {
        console.log('migrateRewardMiner -- START --')
        await migrateRewardMiner();
        console.log('migrateRewardMiner -- END --')
    }

    await delay(0)
    // import migrate_LimitOrderBook from "./23_migrate_LimitOrderBook";
    {
        console.log('migrate_LimitOrderBook -- START --')
        await migrate_LimitOrderBook();
        console.log('migrate_LimitOrderBook -- END --')
    }

    // import migrate_NFTOracle from "./24_migrate_NFTOracle";
    {
        console.log('migrate_NFTOracle -- START --')
        await migrate_NFTOracle();
        console.log('migrate_NFTOracle -- END --')
    }

    {
        console.log('migrate_VBaseToken -- START --')
        await migrate_VBaseToken();
        console.log('migrate_VBaseToken -- END --')
    }

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});