type TokenData = {
    address: string,
    symbol: string,
    name: string,
    decimals: number,
    implAddress: string,
    aggregatorAddress: string,
    priceFeedAddress: string,
    poolAddress: string,
    //tokenomics
    coreAddress: string,
    treasuryAddress: string,
    rewardAddress: string,
    communityAddress: string,
    nftContract: string,
}

type ContractData = {
    address: string,
    implAddress: string
}

type DeployData = {
    verifiedContracts: any,
    platformFundAddress: string,
    makerFundAddress: string,
    priceAdminAddress: string,
    wETH: TokenData,
    vETH: TokenData,
    baseToken: ContractData,
    vBAYC: TokenData,
    vMAYC: TokenData,
    vCRYPTOPUNKS: TokenData,
    vMOONBIRD: TokenData,
    vAZUKI: TokenData,
    vCLONEX: TokenData,
    vDOODLE: TokenData,
    proxyAdminAddress: string,
    uniswapV3Factory: ContractData,
    uniswapV3Broker: ContractData,
    genericLogic: ContractData,
    clearingHouseLogic: ContractData,
    clearingHouse: ContractData,
    clearingHouseConfig: ContractData,
    marketRegistry: ContractData,
    accountBalance: ContractData,
    vPool: ContractData,
    insuranceFund: ContractData,
    vault: ContractData,
    pNFTToken: TokenData,
    rewardMiner: ContractData,
    referralAdminAddress: string,
    referralPayment: ContractData,
    limitOrderBook: ContractData,
    nftOracle: ContractData,
    vBaseToken: ContractData,
    testFaucet: ContractData,
    testCheck: {
        addLiquidity: boolean,
        deposit: boolean,
        openPosition: boolean,
        closePosition: boolean,
        removeLiquidity: boolean,
    }
}

type PriceData = {
    priceBAYC: string,
    priceMAYC: string,
    priceCRYPTOPUNKS: string,
    priceMOONBIRD: string,
    priceAZUKI: string,
    priceCLONEX: string,
    priceDOODLE: string
}