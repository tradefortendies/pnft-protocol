# 
# 
# 

npx hardhat run deploy/testnet/migrate_1Contracts.ts --network arbitrumGoerli --no-compile
npx hardhat run deploy/testnet/migrate_2Init_Config.ts --network arbitrumGoerli --no-compile
npx hardhat run deploy/testnet/migrate_3GetPrices.ts --network mainnet --no-compile
npx hardhat run deploy/testnet/migrate_4SetPrices.ts --network arbitrumGoerli --no-compile
npx hardhat run deploy/testnet/migrate_5InitVToken.ts --network arbitrumGoerli --no-compile
npx hardhat run deploy/testnet/migrate_6AddLiquidity.ts --network arbitrumGoerli --no-compile
npx hardhat run deploy/testnet/migrate_8Trade.ts --network arbitrumGoerli --no-compile
npx hardhat run deploy/testnet/migrate_9StartMiner.ts --network arbitrumGoerli --no-compile
npx hardhat run deploy/testnet/migrate_Repeg.ts --network arbitrumGoerli --no-compile

npx hardhat run deploy/testnet/migrate_Console.ts --network arbitrumGoerli --no-compile
