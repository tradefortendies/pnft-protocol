# 
# 
# 

npx hardhat run deploy/mainnet/migrate_1ContractInit.ts --network arbitrum --no-compile
npx hardhat run deploy/mainnet/migrate_2ConfigUpdate.ts --network arbitrum --no-compile
npx hardhat run deploy/mainnet/migrate_3PriceGet.ts --network arbitrum --no-compile
npx hardhat run deploy/mainnet/migrate_4PriceSet.ts --network arbitrum --no-compile
npx hardhat run deploy/mainnet/migrate_5VTokenInit.ts --network arbitrum --no-compile
npx hardhat run deploy/mainnet/migrate_6LiquidityAdd.ts --network arbitrum --no-compile
npx hardhat run deploy/mainnet/migrate_8MinerStart.ts --network arbitrum --no-compile
npx hardhat run deploy/mainnet/migrate_9PNFTTokenSchedule.ts --network arbitrum --no-compile

npx hardhat run deploy/mainnet/migrate_Console.ts --network arbitrum --no-compile
