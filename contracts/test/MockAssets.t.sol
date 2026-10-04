// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ComplianceRegistry } from "../src/ComplianceRegistry.sol";
import { MockTBILL } from "../src/mocks/MockTBILL.sol";
import { YieldLineFixture } from "./YieldLineFixture.sol";

contract MockAssetsTest is YieldLineFixture {
    function testDecimals() public view {
        assertEq(usdc.decimals(), 6, "MockUSDC decimals");
        assertEq(tbill.decimals(), 18, "MockTBILL decimals");
    }

    function testEligibleTransferToVaultSucceeds() public {
        vm.prank(BORROWER);
        tbill.transfer(address(creditVault), 1e18);
        assertEq(tbill.balanceOf(address(creditVault)), 1e18, "vault received");
    }

    function testMintToIneligibleReverts() public {
        vm.expectRevert(abi.encodeWithSelector(MockTBILL.AccountNotEligible.selector, INELIGIBLE));
        tbill.mint(INELIGIBLE, 1e18);
    }

    function testTransferFromRevokedSenderReverts() public {
        compliance.setEligibility(address(tbill), BORROWER, false);
        vm.prank(BORROWER);
        vm.expectRevert(abi.encodeWithSelector(MockTBILL.AccountNotEligible.selector, BORROWER));
        tbill.transfer(address(creditVault), 1e18);
    }

    function testVaultMustBeEligible() public {
        compliance.setEligibility(address(tbill), address(creditVault), false);
        vm.prank(BORROWER);
        vm.expectRevert(
            abi.encodeWithSelector(MockTBILL.AccountNotEligible.selector, address(creditVault))
        );
        tbill.transfer(address(creditVault), 1e18);
    }

    function testOnlyMinterCanMint() public {
        bytes32 tbillMinter = tbill.MINTER_ROLE();
        bytes32 usdcMinter = usdc.MINTER_ROLE();

        vm.prank(BORROWER);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, BORROWER, tbillMinter
            )
        );
        tbill.mint(BORROWER, 1e18);

        vm.prank(BORROWER);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, BORROWER, usdcMinter
            )
        );
        usdc.mint(BORROWER, 1e6);
    }

    function testPauseBlocksTransfers() public {
        tbill.pause();
        vm.prank(BORROWER);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        tbill.transfer(address(creditVault), 1e18);

        tbill.unpause();
        vm.prank(BORROWER);
        tbill.transfer(address(creditVault), 1e18);
    }

    function testComplianceAdminUpdate() public {
        compliance.setEligibility(address(tbill), LENDER, true);
        assertTrue(compliance.isEligible(address(tbill), LENDER), "eligible after update");
        compliance.setEligibility(address(tbill), LENDER, false);
        assertFalse(compliance.isEligible(address(tbill), LENDER), "revoked");
    }

    function testComplianceUnauthorizedUpdate() public {
        bytes32 role = compliance.COMPLIANCE_ADMIN_ROLE();
        vm.prank(BORROWER);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, BORROWER, role
            )
        );
        compliance.setEligibility(address(tbill), BORROWER, true);
    }

    function testComplianceIsPerAsset() public view {
        assertTrue(compliance.isEligible(address(tbill), BORROWER), "eligible for TBILL");
        assertFalse(compliance.isEligible(address(usdc), BORROWER), "not eligible for other asset");
    }

    function testComplianceRejectsZeroAddress() public {
        vm.expectRevert(ComplianceRegistry.ZeroAddress.selector);
        compliance.setEligibility(address(0), BORROWER, true);
    }
}
