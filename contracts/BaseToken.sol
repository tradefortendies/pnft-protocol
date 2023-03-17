// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;

import { SafeMathUpgradeable } from "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import { IPriceFeedV2 } from "./oracle/interface/IPriceFeedV2.sol";
import { IIndexPrice } from "./interface/IIndexPrice.sol";
import { VirtualToken } from "./VirtualToken.sol";
import { BaseTokenStorageV2 } from "./storage/BaseTokenStorage.sol";
import { IBaseToken } from "./interface/IBaseToken.sol";
import { BlockContext } from "./base/BlockContext.sol";

// never inherit any new stateful contract. never change the orders of parent stateful contracts
contract BaseToken is IBaseToken, IIndexPrice, VirtualToken, BlockContext, BaseTokenStorageV2 {
    using SafeMathUpgradeable for uint256;
    using SafeMathUpgradeable for uint8;

    //
    // CONSTANT
    //

    uint256 internal constant _TWAP_INTERVAL_FOR_PAUSE = 15 * 60; // 15 minutes
    uint256 internal constant _MAX_WAITING_PERIOD = 5 days;

    //
    // EXTERNAL NON-VIEW
    //

    function initialize(string memory nameArg, string memory symbolArg) external initializer {
        __VirtualToken_init(nameArg, symbolArg);
    }
}
