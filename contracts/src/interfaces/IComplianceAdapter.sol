// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IComplianceAdapter {
    function isEligible(address asset, address account) external view returns (bool);
}
