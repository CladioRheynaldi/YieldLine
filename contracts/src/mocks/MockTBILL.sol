// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Pausable } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import { IComplianceAdapter } from "../interfaces/IComplianceAdapter.sol";

contract MockTBILL is ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    IComplianceAdapter public immutable compliance;

    error AccountNotEligible(address account);
    error ZeroAddress();

    constructor(address admin, IComplianceAdapter compliance_)
        ERC20("YieldLine Mock Treasury Bill", "mTBILL")
    {
        if (address(compliance_) == address(0)) revert ZeroAddress();
        compliance = compliance_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function mint(address receiver, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(receiver, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _update(address from, address to, uint256 amount) internal override(ERC20Pausable) {
        if (from != address(0) && !compliance.isEligible(address(this), from)) {
            revert AccountNotEligible(from);
        }
        if (to != address(0) && !compliance.isEligible(address(this), to)) {
            revert AccountNotEligible(to);
        }
        super._update(from, to, amount);
    }
}
