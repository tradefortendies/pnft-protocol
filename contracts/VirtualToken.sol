// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;

import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { SafeOwnable } from "./base/SafeOwnable.sol";
import { IVirtualToken } from "./interface/IVirtualToken.sol";

contract VirtualToken is IVirtualToken, SafeOwnable, ERC20Upgradeable {
    mapping(address => bool) internal _whitelistMap;

    // __gap is reserved storage
    address internal _marketRegistry;
    uint256[49] private __gap;

    event WhitelistAdded(address account);
    event WhitelistRemoved(address account);

    function __VirtualToken_initialize(string memory nameArg, string memory symbolArg) external initializer {
        __SafeOwnable_init();
        __ERC20_init(nameArg, symbolArg);
    }

    function __VirtualToken_init(string memory nameArg, string memory symbolArg) internal initializer {
        __SafeOwnable_init();
        __ERC20_init(nameArg, symbolArg);
    }

    function setMarketRegistry(address marketRegistryArg) external onlyOwner {
        _marketRegistry = marketRegistryArg;
    }

    function mintMaximumTo(address recipient) external override onlyOwner {
        _mint(recipient, type(uint256).max);
    }

    function addWhitelist(address account) external override onlyOwner {
        _whitelistMap[account] = true;
        emit WhitelistAdded(account);
    }

    function marketRegistryAddWhitelist(address account) external override {
        require(_marketRegistry == _msgSender(), "VT_NM");
        _whitelistMap[account] = true;
        emit WhitelistAdded(account);
    }

    function removeWhitelist(address account) external onlyOwner {
        // VT_BNZ: balance is not zero
        require(balanceOf(account) == 0, "VT_BNZ");
        delete _whitelistMap[account];
        emit WhitelistRemoved(account);
    }

    /// @inheritdoc IVirtualToken
    function isInWhitelist(address account) external view override returns (bool) {
        return _whitelistMap[account];
    }

    /// @inheritdoc ERC20Upgradeable
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);

        // `from` == address(0) when mint()
        if (from != address(0)) {
            // not whitelisted
            require(_whitelistMap[from], "VT_NW");
        }
    }
}
