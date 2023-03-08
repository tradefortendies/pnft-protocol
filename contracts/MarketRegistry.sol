// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma abicoder v2;

import { AddressUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import { ClonesUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import { SafeMathUpgradeable } from "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import { SignedSafeMathUpgradeable } from "@openzeppelin/contracts-upgradeable/math/SignedSafeMathUpgradeable.sol";
import { IERC20Metadata } from "./interface/IERC20Metadata.sol";
import { IUniswapV3Factory } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import { IUniswapV3Pool } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import { ClearingHouseCallee } from "./base/ClearingHouseCallee.sol";
import { UniswapV3Broker } from "./lib/UniswapV3Broker.sol";
import { IVirtualToken } from "./interface/IVirtualToken.sol";
import { MarketRegistryStorage2 } from "./storage/MarketRegistryStorage.sol";
import { IMarketRegistry } from "./interface/IMarketRegistry.sol";
import { IClearingHouse } from "./interface/IClearingHouse.sol";
import { IClearingHouseConfig } from "./interface/IClearingHouseConfig.sol";
import { IVPool } from "./interface/IVPool.sol";
import { DataTypes } from "./types/DataTypes.sol";
import { PerpMath } from "./lib/PerpMath.sol";
import { PerpSafeCast } from "./lib/PerpSafeCast.sol";

// never inherit any new stateful contract. never change the orders of parent stateful contracts
contract MarketRegistry is IMarketRegistry, ClearingHouseCallee, MarketRegistryStorage2 {
    using AddressUpgradeable for address;
    using SafeMathUpgradeable for uint256;
    using SignedSafeMathUpgradeable for int256;
    using PerpSafeCast for uint256;
    using PerpSafeCast for uint128;
    using PerpSafeCast for uint24;
    using PerpSafeCast for int256;
    using PerpMath for uint256;
    using PerpMath for uint160;
    using PerpMath for uint128;
    using PerpMath for int256;

    //
    // MODIFIER
    //

    modifier checkRatio(uint24 ratio) {
        // ratio overflow
        require(ratio <= 1e6, "MR_RO");
        _;
    }

    modifier checkPool(address baseToken) {
        // pool not exists
        require(baseToken == address(0) || _poolMap[baseToken] != address(0), "MR_PNE");
        _;
    }

    //
    // EXTERNAL NON-VIEW
    //

    function initialize(address uniswapV3FactoryArg, address quoteTokenArg) external initializer {
        __ClearingHouseCallee_init();

        // UnsiwapV3Factory is not contract
        require(uniswapV3FactoryArg.isContract(), "MR_UFNC");
        // QuoteToken is not contract
        require(quoteTokenArg.isContract(), "MR_QTNC");

        // update states
        _uniswapV3Factory = uniswapV3FactoryArg;
        _quoteToken = quoteTokenArg;
        _maxOrdersPerMarket = type(uint8).max;

        _insuranceFundFeeRatioGlobal = 500; // 0.05%
        _platformFundFeeRatioGlobal = 2000; // 0.2%
        _optimalDeltaTwapRatioGlobal = 30000; // 3%
        _unhealthyDeltaTwapRatioGlobal = 50000; // 5%
        _optimalFundingRatioGlobal = 250000; // 25%

        _minQuoteTickCrossedGlobal = 1 ether;
        _maxQuoteTickCrossedGlobal = 1e3 ether;
        _defaultQuoteTickCrossedGlobal = 5 ether;
    }

    function addPool(address baseToken, address nftContractArg, uint24 feeRatio) external onlyOwner returns (address) {
        return _addPool(baseToken, nftContractArg, feeRatio, _msgSender(), _msgSender(), false);
    }

    function createIsolatedPool(
        address nftContractArg,
        string memory symbolArg,
        uint160 sqrtPriceX96
    ) external returns (address, address) {
        require(_defaultQuoteTickCrossedGlobal > 0, "MR_DQCTZ");
        uint24 uniFeeTier = 3000;
        // create baseToken
        address baseToken = _createBaseToken(symbolArg, sqrtPriceX96);
        // add pool
        address uniPool = _addPool(baseToken, nftContractArg, uniFeeTier, _msgSender(), _msgSender(), true);
        //
        IVPool(IClearingHouse(_clearingHouse).getVPool()).setMaxTickCrossedWithinBlock(baseToken, 100);
        // add liquidity
        uint256 liquidity = PerpMath.calculateLiquidity(
            _defaultQuoteTickCrossedGlobal,
            IVPool(IClearingHouse(_clearingHouse).getVPool())
                .getMaxTickCrossedWithinBlock(baseToken)
                .toUint256()
                .mul(100)
                .toUint24(),
            IVPool(IClearingHouse(_clearingHouse).getVPool()).getMarkPrice(baseToken)
        );
        IClearingHouse(_clearingHouse).addLiquidity(
            DataTypes.AddLiquidityParams({
                baseToken: baseToken,
                liquidity: liquidity.toUint128(),
                deadline: type(uint256).max
            })
        );
        return (baseToken, uniPool);
    }

    function _createBaseToken(string memory symbolArg, uint160 sqrtPriceX96) internal returns (address) {
        // appne prefix v for symbol
        symbolArg = string(abi.encodePacked("v", symbolArg));
        //
        uint24 uniFeeTier = 3000;
        // create baseToken
        bytes memory _initializationCalldata = abi.encodeWithSignature(
            "__VirtualToken_initialize(string,string)",
            symbolArg,
            symbolArg
        );
        address baseToken = ClonesUpgradeable.clone(_vBaseToken);
        AddressUpgradeable.functionCall(baseToken, _initializationCalldata);
        // whitelist
        IVirtualToken(baseToken).addWhitelist(_clearingHouse);
        IVirtualToken(baseToken).mintMaximumTo(_clearingHouse);
        // add pool
        address poolAddr = IUniswapV3Factory(_uniswapV3Factory).createPool(baseToken, _quoteToken, uniFeeTier);
        // whitelist
        IVirtualToken(baseToken).addWhitelist(poolAddr);
        IVirtualToken(_quoteToken).marketRegistryAddWhitelist(poolAddr);
        // init price
        IUniswapV3Pool(poolAddr).initialize(sqrtPriceX96);
        //
        return baseToken;
    }

    function _addPool(
        address baseToken,
        address nftContractArg,
        uint24 feeRatio,
        address creatorArg,
        address feeReceiverArg,
        bool isIsolatedArg
    ) internal returns (address) {
        // existent pool
        require(_poolMap[baseToken] == address(0), "MR_EP");
        // baseToken decimals is not 18
        require(IERC20Metadata(baseToken).decimals() == 18, "MR_BDN18");
        // clearingHouse base token balance not enough
        require(IERC20Metadata(baseToken).balanceOf(_clearingHouse) == type(uint256).max, "MR_CHBNE");

        // quote token total supply not enough
        require(IERC20Metadata(_quoteToken).totalSupply() == type(uint256).max, "MR_QTSNE");

        // to ensure the base is always token0 and quote is always token1
        // invalid baseToken
        require(baseToken < _quoteToken, "MR_IB");

        address uniPool = UniswapV3Broker.getPool(_uniswapV3Factory, _quoteToken, baseToken, feeRatio);
        // non-existent pool in uniswapV3 factory
        require(uniPool != address(0), "MR_NEP");

        (uint256 sqrtPriceX96, , , , , , ) = UniswapV3Broker.getSlot0(uniPool);
        // pool not (yet) initialized
        require(sqrtPriceX96 != 0, "MR_PNI");

        // clearingHouse not in baseToken whitelist
        require(IVirtualToken(baseToken).isInWhitelist(_clearingHouse), "MR_CNBWL");
        // pool not in baseToken whitelist
        require(IVirtualToken(baseToken).isInWhitelist(uniPool), "MR_PNBWL");

        // clearingHouse not in quoteToken whitelist
        require(IVirtualToken(_quoteToken).isInWhitelist(_clearingHouse), "MR_CHNQWL");
        // pool not in quoteToken whitelist
        require(IVirtualToken(_quoteToken).isInWhitelist(uniPool), "MR_PNQWL");

        _poolMap[baseToken] = uniPool;
        _uniswapFeeRatioMap[baseToken] = feeRatio;
        // _insuranceFundFeeRatioMap[baseToken] = 500; // 0.05%
        // _platformFundFeeRatioMap[baseToken] = 2000; // 0.2%
        // _optimalDeltaTwapRatioMap[baseToken] = 30000; // 3%
        // _unhealthyDeltaTwapRatioMap[baseToken] = 50000; // 5%
        // _optimalFundingRatioMap[baseToken] = 250000; // 25%
        // for open protocol
        _nftContractMap[baseToken] = nftContractArg;
        _feeReceiverMap[baseToken] = feeReceiverArg;
        _creatorMap[baseToken] = creatorArg;
        _isolatedMap[baseToken] = isIsolatedArg;

        emit PoolAdded(baseToken, nftContractArg, creatorArg, isIsolatedArg, uniPool);

        return uniPool;
    }

    // function setPlatformFundFeeRatio(
    //     address baseToken,
    //     uint24 feeRatio
    // ) external checkPool(baseToken) checkRatio(feeRatio) onlyOwner {
    //     _platformFundFeeRatioMap[baseToken] = feeRatio;
    //     emit PlatformFundFeeRatioChanged(baseToken, feeRatio);
    // }

    // function setInsuranceFundFeeRatio(
    //     address baseToken,
    //     uint24 feeRatio
    // ) external checkPool(baseToken) checkRatio(feeRatio) onlyOwner {
    //     _insuranceFundFeeRatioMap[baseToken] = feeRatio;
    //     emit InsuranceFundFeeRatioChanged(baseToken, feeRatio);
    // }

    function setMaxOrdersPerMarket(uint8 maxOrdersPerMarketArg) external onlyOwner {
        _maxOrdersPerMarket = maxOrdersPerMarketArg;
        emit MaxOrdersPerMarketChanged(maxOrdersPerMarketArg);
    }

    // function setOptimalDeltaTwapRatio(
    //     address baseToken,
    //     uint24 optimalDeltaTwapRatio
    // ) external checkPool(baseToken) onlyOwner {
    //     _optimalDeltaTwapRatioMap[baseToken] = optimalDeltaTwapRatio;
    // }

    function setNftContract(address baseToken, address nftContractArg) external checkPool(baseToken) onlyOwner {
        _nftContractMap[baseToken] = nftContractArg;
    }

    function setCreator(address baseToken, address creatorArg) external checkPool(baseToken) onlyOwner {
        _creatorMap[baseToken] = creatorArg;
    }

    function setVBaseToken(address vBaseTokenArg) external onlyOwner {
        _vBaseToken = vBaseTokenArg;
    }

    function setInsuranceFundFeeRatioGlobal(
        uint24 insuranceFundFeeRatioGlobalArg
    ) external checkRatio(insuranceFundFeeRatioGlobalArg) onlyOwner {
        _insuranceFundFeeRatioGlobal = insuranceFundFeeRatioGlobalArg;
    }

    function setPlatformFundFeeRatioGlobal(
        uint24 platformFundFeeRatioGlobalArg
    ) external checkRatio(platformFundFeeRatioGlobalArg) onlyOwner {
        _platformFundFeeRatioGlobal = platformFundFeeRatioGlobalArg;
    }

    function setOptimalDeltaTwapRatioGlobal(
        uint24 optimalDeltaTwapRatioGlobalArg
    ) external checkRatio(optimalDeltaTwapRatioGlobalArg) onlyOwner {
        _optimalDeltaTwapRatioGlobal = optimalDeltaTwapRatioGlobalArg;
    }

    function setUnhealthyDeltaTwapRatioGlobal(
        uint24 unhealthyDeltaTwapRatioGlobalArg
    ) external checkRatio(unhealthyDeltaTwapRatioGlobalArg) onlyOwner {
        _unhealthyDeltaTwapRatioGlobal = unhealthyDeltaTwapRatioGlobalArg;
    }

    function setOptimalFundingRatioGlobal(
        uint24 optimalFundingRatioGlobalArg
    ) external checkRatio(optimalFundingRatioGlobalArg) onlyOwner {
        _optimalFundingRatioGlobal = optimalFundingRatioGlobalArg;
    }

    function setSharePlatformFeeRatioGlobal(
        uint24 sharePlatformFeeRatioGlobalArg
    ) external checkRatio(sharePlatformFeeRatioGlobalArg) onlyOwner {
        _sharePlatformFeeRatioGlobal = sharePlatformFeeRatioGlobalArg;
    }

    function setMinQuoteTickCrossedGlobal(uint128 minQuoteTickCrossedGlobalArg) external onlyOwner {
        require(_defaultQuoteTickCrossedGlobal < _maxQuoteTickCrossedGlobal, "MR_IV");
        require(_minQuoteTickCrossedGlobal < _defaultQuoteTickCrossedGlobal, "MR_IV");
        _minQuoteTickCrossedGlobal = minQuoteTickCrossedGlobalArg;
    }

    function setMaxQuoteTickCrossedGlobal(uint128 maxQuoteTickCrossedGlobalArg) external onlyOwner {
        require(_defaultQuoteTickCrossedGlobal < _maxQuoteTickCrossedGlobal, "MR_IV");
        require(_minQuoteTickCrossedGlobal < _defaultQuoteTickCrossedGlobal, "MR_IV");
        _maxQuoteTickCrossedGlobal = maxQuoteTickCrossedGlobalArg;
    }

    function setDefaultQuoteTickCrossedGlobal(uint128 defaultQuoteTickCrossedGlobalArg) external onlyOwner {
        require(_defaultQuoteTickCrossedGlobal < _maxQuoteTickCrossedGlobal, "MR_IV");
        require(_minQuoteTickCrossedGlobal < _defaultQuoteTickCrossedGlobal, "MR_IV");
        _defaultQuoteTickCrossedGlobal = defaultQuoteTickCrossedGlobalArg;
    }

    //
    // EXTERNAL VIEW
    //

    /// @inheritdoc IMarketRegistry
    function getQuoteToken() external view override returns (address) {
        return _quoteToken;
    }

    /// @inheritdoc IMarketRegistry
    function getUniswapV3Factory() external view override returns (address) {
        return _uniswapV3Factory;
    }

    /// @inheritdoc IMarketRegistry
    function getMaxOrdersPerMarket() external view override returns (uint8) {
        return _maxOrdersPerMarket;
    }

    /// @inheritdoc IMarketRegistry
    function getPool(address baseToken) external view override checkPool(baseToken) returns (address) {
        return _poolMap[baseToken];
    }

    /// @inheritdoc IMarketRegistry
    function getInsuranceFundFeeRatio(address baseToken) external view override checkPool(baseToken) returns (uint24) {
        return _insuranceFundFeeRatioGlobal;
    }

    function getPlatformFundFeeRatio(address baseToken) external view override checkPool(baseToken) returns (uint24) {
        return _platformFundFeeRatioGlobal;
    }

    function getOptimalDeltaTwapRatio(address baseToken) external view override checkPool(baseToken) returns (uint24) {
        return _optimalDeltaTwapRatioGlobal;
    }

    function getOptimalFundingRatio(address baseToken) external view override checkPool(baseToken) returns (uint24) {
        return _optimalFundingRatioGlobal;
    }

    function getNftContract(address baseToken) external view override checkPool(baseToken) returns (address) {
        return _nftContractMap[baseToken];
    }

    function getCreator(address baseToken) external view override checkPool(baseToken) returns (address) {
        return _creatorMap[baseToken];
    }

    /// @inheritdoc IMarketRegistry
    function getMarketInfo(address baseToken) external view override checkPool(baseToken) returns (MarketInfo memory) {
        return
            MarketInfo({
                pool: _poolMap[baseToken],
                uniswapFeeRatio: _uniswapFeeRatioMap[baseToken],
                insuranceFundFeeRatio: _insuranceFundFeeRatioGlobal,
                platformFundFeeRatio: _platformFundFeeRatioGlobal,
                optimalDeltaTwapRatio: _optimalDeltaTwapRatioGlobal,
                unhealthyDeltaTwapRatio: _unhealthyDeltaTwapRatioGlobal,
                optimalFundingRatio: _optimalFundingRatioGlobal
            });
    }

    /// @inheritdoc IMarketRegistry
    function hasPool(address baseToken) external view override returns (bool) {
        return _poolMap[baseToken] != address(0);
    }

    /// @inheritdoc IMarketRegistry
    function isIsolated(address baseToken) external view override checkPool(baseToken) returns (bool) {
        return baseToken == address(0) ? false : _isolatedMap[baseToken];
    }

    function getInsuranceFundFeeRatioGlobal() external view override returns (uint24) {
        return _insuranceFundFeeRatioGlobal;
    }

    function getPlatformFundFeeRatioGlobal() external view override returns (uint24) {
        return _platformFundFeeRatioGlobal;
    }

    function getOptimalDeltaTwapRatioGlobal() external view override returns (uint24) {
        return _optimalDeltaTwapRatioGlobal;
    }

    function getUnhealthyDeltaTwapRatioGlobal() external view override returns (uint24) {
        return _unhealthyDeltaTwapRatioGlobal;
    }

    function getOptimalFundingRatioGlobal() external view override returns (uint24) {
        return _optimalFundingRatioGlobal;
    }

    function getSharePlatformFeeRatioGlobal() external view override returns (uint24) {
        return _sharePlatformFeeRatioGlobal;
    }

    function getMinQuoteTickCrossedGlobal() external view override returns (uint256) {
        return _minQuoteTickCrossedGlobal;
    }

    function getMaxQuoteTickCrossedGlobal() external view override returns (uint256) {
        return _maxQuoteTickCrossedGlobal;
    }

    function getDefaultQuoteTickCrossedGlobal() external view override returns (uint256) {
        return _defaultQuoteTickCrossedGlobal;
    }
}
