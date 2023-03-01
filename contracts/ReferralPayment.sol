// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma abicoder v2;

import { ECDSAUpgradeable } from "@openzeppelin/contracts-upgradeable/cryptography/ECDSAUpgradeable.sol";
import { AddressUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import { SafeMathUpgradeable } from "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import { SafeERC20Upgradeable, IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import { OwnerPausable } from "./base/OwnerPausable.sol";
import { BlockContext } from "./base/BlockContext.sol";
import { IReferralPayment } from "./interface/IReferralPayment.sol";
import { ReferralPaymentStorage } from "./storage/ReferralPaymentStorage.sol";

// never inherit any new stateful contract. never change the orders of parent stateful contracts
contract ReferralPayment is IReferralPayment, BlockContext, OwnerPausable, ReferralPaymentStorage {
    using AddressUpgradeable for address;
    using SafeMathUpgradeable for uint256;

    event Paid(address indexed user, uint256 amount, uint256 total);

    modifier checkDeadline(uint256 deadline) {
        require(_blockTimestamp() <= deadline, "RP_TE");
        _;
    }

    //
    // EXTERNAL NON-VIEW
    //
    /// @dev this function is public for testing
    // solhint-disable-next-line func-order
    function initialize(address pnftTokenArg, address adminArg) public initializer {
        __OwnerPausable_init();
        //
        _pnftToken = pnftTokenArg;
        _admin = adminArg;
    }

    function _isContract(address contractArg, string memory errorMsg) internal view {
        require(contractArg.isContract(), errorMsg);
    }

    function setAdmin(address adminArg) external {
        _admin = adminArg;
    }

    function getAdmin() external view returns (address admin) {
        admin = _admin;
    }

    function getUserPayment(address user) external view returns (uint256 lastPayment) {
        lastPayment = _lastUserPayments[user];
    }

    function getMessageHash(address user, uint256 total, uint256 deadline) public view returns (bytes32) {
        return keccak256(abi.encode(address(this), _admin, user, total, deadline));
    }

    function _verifySigner(
        address user,
        uint256 total,
        uint256 deadline,
        bytes memory signature
    ) internal view returns (address, bytes32) {
        bytes32 messageHash = getMessageHash(user, total, deadline);
        address signer = ECDSAUpgradeable.recover(ECDSAUpgradeable.toEthSignedMessageHash(messageHash), signature);
        // RP_NA: Signer Is Not ADmin
        require(signer == _admin, "RP_NA");
        return (signer, messageHash);
    }

    function claim(
        address user,
        uint256 total,
        uint256 deadline,
        bytes memory signature
    ) external override checkDeadline(deadline) {
        _verifySigner(user, total, deadline, signature);
        // RP_ZA: invaild amount
        require(total > _lastUserPayments[user], "RP_IA");
        uint256 amount = total.sub(_lastUserPayments[user]);
        SafeERC20Upgradeable.safeTransfer(IERC20Upgradeable(_pnftToken), user, amount);
        _lastUserPayments[user] = total;
        emit Paid(user, amount, total);
    }

    function emergencyWithdraw(uint256 amount) external onlyOwner {
        SafeERC20Upgradeable.safeTransfer(IERC20Upgradeable(_pnftToken), _msgSender(), amount);
    }
}
