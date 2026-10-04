// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IComplianceAdapter } from "./interfaces/IComplianceAdapter.sol";

contract ComplianceRegistry is AccessControl, IComplianceAdapter {
    bytes32 public constant COMPLIANCE_ADMIN_ROLE = keccak256("COMPLIANCE_ADMIN_ROLE");

    mapping(address asset => mapping(address account => bool)) private _eligible;

    event EligibilityUpdated(address indexed asset, address indexed account, bool eligible);

    error ZeroAddress();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(COMPLIANCE_ADMIN_ROLE, admin);
    }

    function setEligibility(address asset, address account, bool eligible)
        external
        onlyRole(COMPLIANCE_ADMIN_ROLE)
    {
        if (asset == address(0) || account == address(0)) revert ZeroAddress();
        _eligible[asset][account] = eligible;
        emit EligibilityUpdated(asset, account, eligible);
    }

    function isEligible(address asset, address account) external view returns (bool) {
        return _eligible[asset][account];
    }
}
