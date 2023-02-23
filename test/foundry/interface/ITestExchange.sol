pragma solidity 0.7.6;
pragma abicoder v2;

import "../../../contracts/interface/IVPool.sol";

interface ITestExchange is IVPool {
    function initialize(
        address marketRegistryArg,
        address orderBookArg,
        address clearingHouseConfigArg
    ) external;

    function setAccountBalance(address accountBalanceArg) external;

    function setMaxTickCrossedWithinBlock(address baseToken, uint24 maxTickCrossedWithinBlock) external;

    function setClearingHouse(address clearingHouseArg) external;
}
