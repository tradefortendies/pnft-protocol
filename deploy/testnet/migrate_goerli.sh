# 
# 
# 

npx hardhat run deploy/mainnet/migrate_1ContractInit.ts --network arbitrumGoerli --no-compile
npx hardhat run deploy/mainnet/migrate_2ConfigUpdate.ts --network arbitrumGoerli --no-compile
npx hardhat run deploy/mainnet/migrate_3PriceGet.ts --network arbitrumGoerli --no-compile
npx hardhat run deploy/mainnet/migrate_4PriceSet.ts --network arbitrumGoerli --no-compile
npx hardhat run deploy/mainnet/migrate_5VTokenInit.ts --network arbitrumGoerli --no-compile
npx hardhat run deploy/mainnet/migrate_6LiquidityAdd.ts --network arbitrumGoerli --no-compile
npx hardhat run deploy/mainnet/migrate_8MinerStart.ts --network arbitrumGoerli --no-compile

npx hardhat run deploy/mainnet/migrate_Console.ts --network arbitrumGoerli --no-compile