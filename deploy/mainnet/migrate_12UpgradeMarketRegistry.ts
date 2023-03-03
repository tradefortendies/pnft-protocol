import fs from "fs";

import migrateMarketRegistry from "./8_migrate_MarketRegistry";

async function main() {
    await deploy();
}

export default deploy;

async function deploy() {
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