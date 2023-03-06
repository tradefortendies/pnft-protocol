import fs from "fs";

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

async function main() {
    await deploy();
}

export default deploy;

async function deploy() {
    // import migrateInsuranceFund from "./12_migrate_InsuranceFund";
    {
        console.log('migrateInsuranceFund -- START --')
        await migrateInsuranceFund();
        console.log('migrateInsuranceFund -- END --')
    }

    // import migrateRewardMiner from "./21_migrate_RewardMiner";
    {
        console.log('migrateRewardMiner -- START --')
        await migrateRewardMiner();
        console.log('migrateRewardMiner -- END --')
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});