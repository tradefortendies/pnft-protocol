# 
# 
# 
npx hardhat run deploy/mainnet/migrate_1ContractInit.ts --network arbitrumTest --no-compile
npx hardhat run deploy/mainnet/migrate_2ConfigUpdate.ts --network arbitrumTest --no-compile
npx hardhat run deploy/mainnet/migrate_3PriceGet.ts --network arbitrumTest --no-compile
npx hardhat run deploy/mainnet/migrate_4PriceSet.ts --network arbitrumTest --no-compile
npx hardhat run deploy/mainnet/migrate_5VTokenInit.ts --network arbitrumTest --no-compile
npx hardhat run deploy/mainnet/migrate_6LiquidityAdd.ts --network arbitrumTest --no-compile
npx hardhat run deploy/mainnet/migrate_8MinerStart.ts --network arbitrumTest --no-compile

npx hardhat run deploy/mainnet/migrate_Console.ts --network arbitrumTest --no-compile