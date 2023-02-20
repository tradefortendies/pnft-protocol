# 
# 
# 
npx hardhat run deploy/testnet/migrate_1Contracts.ts --network arbitrumTest --no-compile
npx hardhat run deploy/testnet/migrate_2Init_Config.ts --network arbitrumTest --no-compile
npx hardhat run deploy/testnet/migrate_3GetPrices.ts --network mainnet --no-compile
npx hardhat run deploy/testnet/migrate_4SetPrices.ts --network arbitrumTest --no-compile
npx hardhat run deploy/testnet/migrate_5InitVToken.ts --network arbitrumTest --no-compile
npx hardhat run deploy/testnet/migrate_6AddLiquidity.ts --network arbitrumTest --no-compile
npx hardhat run deploy/testnet/migrate_7Faucet.ts --network arbitrumTest --no-compile
npx hardhat run deploy/testnet/migrate_8Trade.ts --network arbitrumTest --no-compile
npx hardhat run deploy/testnet/migrate_9StartMiner.ts --network arbitrumTest --no-compile

npx hardhat run deploy/testnet/migrate_Console.ts --network arbitrumTest --no-compile