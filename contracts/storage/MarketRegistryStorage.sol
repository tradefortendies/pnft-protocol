// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;

/// @notice For future upgrades, do not change MarketRegistryStorageV1. Create a new
/// contract which implements MarketRegistryStorageV1 and following the naming convention
/// MarketRegistryStorageVX.
abstract contract MarketRegistryStorageV1 {
    address internal _uniswapV3Factory;
    address internal _quoteToken;

    uint8 internal _maxOrdersPerMarket;

    address[10] private __gap1;
    uint256[10] private __gap2;

    // key: baseToken, value: pool
    mapping(address => address) internal _poolMap;

    // key: baseToken, what insurance fund get = exchangeFee * insuranceFundFeeRatio
    mapping(address => uint24) internal __insuranceFundFeeRatioMap;

    // key: baseToken , uniswap fee will be ignored and use the exchangeFeeRatio instead
    mapping(address => uint24) internal __platformFundFeeRatioMap;

    // key: baseToken, _uniswapFeeRatioMap cache only
    mapping(address => uint24) internal _uniswapFeeRatioMap;

    mapping(address => uint24) internal __optimalDeltaTwapRatioMap;

    mapping(address => uint24) internal __optimalFundingRatioMap;

    mapping(address => uint24) internal __unhealthyDeltaTwapRatioMap;
}

abstract contract MarketRegistryStorage2 is MarketRegistryStorageV1 {
    //
    address internal _vBaseToken;
    //
    uint24 internal _insuranceFundFeeRatioGlobal; //[baseToken] = 500; // 0.05%
    uint24 internal _platformFundFeeRatioGlobal; //[baseToken] = 2000; // 0.2%
    uint24 internal _optimalDeltaTwapRatioGlobal; //[baseToken] = 30000; // 3%
    uint24 internal _unhealthyDeltaTwapRatioGlobal; //[baseToken] = 50000; // 5%
    uint24 internal _optimalFundingRatioGlobal; //[baseToken] = 250000; // 25%
    uint256 internal _minQuoteTickCrossedGlobal;
    uint256 internal _maxQuoteTickCrossedGlobal;
    // percent share platform fee
    uint24 internal _sharePlatformFeeRatioGlobal; //[baseToken] = 500000; // 50%
    //
    mapping(address => address) internal _nftContractMap;
    // baseToken
    mapping(address => bool) internal _isolatedMap;
    // baseToken
    mapping(address => address) internal _creatorMap;
    //
    mapping(address => address) internal _feeReceiverMap;
    // baseToken -> feeRatio
    mapping(address => uint24) internal _sharePlatformFeeRatioMap;
    //
    uint256 internal _defaultQuoteTickCrossedGlobal;
    //
    uint256 internal _minInsuranceFundPerContribution;
    // nft address -> book
    mapping(address => bool) internal _nftCreatedMap;
    // baseToken -> isOpen
    mapping(address => bool) internal _isOpenMap;
    //
    address internal _insuranceFund;
    //
    uint256 internal _minInsuranceFundPerCreated;
}
