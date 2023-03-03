// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;

interface IVirtualToken {
    function isInWhitelist(address account) external view returns (bool);

    function mintMaximumTo(address recipient) external;

    function addWhitelist(address account) external;

    function marketRegistryAddWhitelist(address account) external;
}
