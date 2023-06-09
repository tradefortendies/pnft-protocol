// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;

import { DataTypes } from "../types/DataTypes.sol";

/// @notice For future upgrades, do not change AccountBalanceStorageV1. Create a new
/// contract which implements AccountBalanceStorageV1 and following the naming convention
/// AccountBalanceStorageVX.
abstract contract AccountBalanceStorageV1 {
    address internal _clearingHouseConfig;
    address internal __orderBook;
    address internal _vault;

    address internal _marketRegistry;

    address[9] private __gap1;
    uint256[10] private __gap2;

    // trader => owedRealizedPnl
    mapping(address => int256) internal _owedRealizedPnlMap;

    // trader => baseTokens
    // base token registry of each trader
    mapping(address => address[]) internal _baseTokensMap;

    mapping(address => DataTypes.MarketInfo) internal _marketMap;

    // first key: trader, second key: baseToken
    mapping(address => mapping(address => DataTypes.AccountMarketInfo)) internal _accountMarketMap;
}

abstract contract AccountBalanceStorageV2 is AccountBalanceStorageV1 {
    // baseToken -> user -> isolated relaized pnl
    mapping(address => mapping(address => int256)) internal _isolatedOwedRealizedPnlMap;
}
