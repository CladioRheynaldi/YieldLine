// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface Vm {
    function warp(uint256 timestamp) external;
    function prank(address sender) external;
    function startPrank(address sender) external;
    function stopPrank() external;
    function expectRevert() external;
    function expectRevert(bytes4 selector) external;
    function expectRevert(bytes calldata revertData) external;
    function assume(bool condition) external pure;
}

abstract contract TestBase {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    error AssertionFailed(string message);
    error AssertionFailedUint(string message, uint256 left, uint256 right);

    function assertTrue(bool value, string memory message) internal pure {
        if (!value) revert AssertionFailed(message);
    }

    function assertFalse(bool value, string memory message) internal pure {
        if (value) revert AssertionFailed(message);
    }

    function assertEq(uint256 left, uint256 right, string memory message) internal pure {
        if (left != right) revert AssertionFailedUint(message, left, right);
    }

    function assertEq(address left, address right, string memory message) internal pure {
        if (left != right) revert AssertionFailed(message);
    }

    function assertLe(uint256 left, uint256 right, string memory message) internal pure {
        if (left > right) revert AssertionFailedUint(message, left, right);
    }

    function assertGe(uint256 left, uint256 right, string memory message) internal pure {
        if (left < right) revert AssertionFailedUint(message, left, right);
    }

    function assertApproxEq(uint256 left, uint256 right, uint256 tolerance, string memory message)
        internal
        pure
    {
        uint256 delta = left > right ? left - right : right - left;
        if (delta > tolerance) revert AssertionFailedUint(message, left, right);
    }

    function bound(uint256 value, uint256 min, uint256 max) internal pure returns (uint256) {
        if (min > max) revert AssertionFailed("bound: min > max");
        if (max - min == type(uint256).max) return value;
        return min + (value % (max - min + 1));
    }
}
