import fs from "fs";

import migrate_ClearingHouse from "./13_migrate_ClearingHouse";

async function main() {
    await deploy();
}

export default deploy;

async function deploy() {
    {
        console.log('migrate_ClearingHouse -- START --')
        await migrate_ClearingHouse();
        console.log('migrate_ClearingHouse -- END --')
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});