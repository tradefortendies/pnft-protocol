# 
# 
# 

npx hardhat run deploy/mainnet/migrate_1ContractInit.ts --network local --no-compile
npx hardhat run deploy/mainnet/migrate_2ConfigUpdate.ts --network local --no-compile
npx hardhat run deploy/mainnet/migrate_3PriceGet.ts --network local --no-compile
npx hardhat run deploy/mainnet/migrate_4PriceSet.ts --network local --no-compile
npx hardhat run deploy/mainnet/migrate_5VTokenInit.ts --network local --no-compile
npx hardhat run deploy/mainnet/migrate_6LiquidityAdd.ts --network local --no-compile
npx hardhat run deploy/mainnet/migrate_8MinerStart.ts --network local --no-compile

npx hardhat run deploy/mainnet/migrate_Console.ts --network local --no-compile