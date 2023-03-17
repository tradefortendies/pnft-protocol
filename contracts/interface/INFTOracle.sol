// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.6;

/************
@title INFTOracleGetter interface
@notice Interface for getting NFT price oracle.*/
interface INFTOracle {
    /* CAUTION: Price uint is ETH based (WEI, 18 decimals) */
    /***********
    @dev returns the asset price in ETH
     */
    function getNftPrice(address asset) external view returns (uint256);
}
