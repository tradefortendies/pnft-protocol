// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma abicoder v2;

import { OwnerPausable } from "./base/OwnerPausable.sol";
import { BlockContext } from "./base/BlockContext.sol";
import { INFTOracle } from "./interface/INFTOracle.sol";
import { NFTOracleStorage } from "./storage/NFTOracleStorage.sol";

// never inherit any new stateful contract. never change the orders of parent stateful contracts
contract NFTOracle is INFTOracle, BlockContext, OwnerPausable, NFTOracleStorage {
    event NftPriceUpdated(address indexed nftContract, uint256 price);

    modifier onlyPriceAdmin() {
        // NO_NA: not priceAdmin
        require(_msgSender() == _priceFeedAdmin, "NO_NA");
        _;
    }

    //
    // EXTERNAL NON-VIEW
    //
    /// @dev this function is public for testing
    // solhint-disable-next-line func-order
    function initialize() public initializer {
        __OwnerPausable_init();
        //
        _priceFeedAdmin = _msgSender();
    }

    function setPriceAdmin(address priceAdminArg) external onlyOwner {
        _priceFeedAdmin = priceAdminArg;
    }

    function getPriceAdmin() external view returns (address priceAdmin) {
        priceAdmin = _priceFeedAdmin;
    }

    function setNftPrice(address _nftContract, uint256 _price) external onlyPriceAdmin {
        _setNftPrice(_nftContract, _price);
    }

    function setMultipleNftPrices(
        address[] calldata _nftContracts,
        uint256[] calldata _prices
    ) external onlyPriceAdmin {
        require(_nftContracts.length == _prices.length, "NO_IL");
        for (uint256 i = 0; i < _nftContracts.length; i++) {
            _setNftPrice(_nftContracts[i], _prices[i]);
        }
    }

    function _setNftPrice(address nftContractArg, uint256 _price) internal {
        require(_price > 0, "NO_IP");
        _nftPrices[nftContractArg] = _price;
        emit NftPriceUpdated(nftContractArg, _price);
    }

    function getNftPrice(address nftContractArg) external view override returns (uint256) {
        return _nftPrices[nftContractArg];
    }
}
