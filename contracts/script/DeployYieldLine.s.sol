// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ComplianceRegistry } from "../src/ComplianceRegistry.sol";
import { MockRWAOracle } from "../src/mocks/MockRWAOracle.sol";
import { MockTBILL } from "../src/mocks/MockTBILL.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { OracleAdapter } from "../src/OracleAdapter.sol";
import { RWARegistry } from "../src/RWARegistry.sol";
import { RWACreditVault } from "../src/RWACreditVault.sol";
import { RWARiskEngine } from "../src/RWARiskEngine.sol";
import { USDCLiquidityVault } from "../src/USDCLiquidityVault.sol";
import { IRWARegistry } from "../src/interfaces/IRWARegistry.sol";

interface Vm {
    function envUint(string calldata name) external view returns (uint256);
    function envOr(string calldata name, address defaultValue) external view returns (address);
    function addr(uint256 privateKey) external pure returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
    function projectRoot() external view returns (string memory);
    function serializeUint(string calldata objectKey, string calldata valueKey, uint256 value)
        external
        returns (string memory);
    function serializeAddress(string calldata objectKey, string calldata valueKey, address value)
        external
        returns (string memory);
    function writeJson(string calldata json, string calldata path) external;
}

contract DeployYieldLine {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    error WrongChain(uint256 actual);

    uint256 private constant ARBITRUM_SEPOLIA = 421_614;
    uint256 private constant ANVIL = 31_337;

    function run() external {
        if (block.chainid != ARBITRUM_SEPOLIA && block.chainid != ANVIL) {
            revert WrongChain(block.chainid);
        }
        uint256 deploymentBlock = block.number;

        uint256 privateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        address lender = vm.envOr("DEMO_LENDER", deployer);
        address borrower = vm.envOr("DEMO_BORROWER", deployer);

        vm.startBroadcast(privateKey);

        MockUSDC usdc = new MockUSDC(deployer);
        ComplianceRegistry compliance = new ComplianceRegistry(deployer);
        MockTBILL tbill = new MockTBILL(deployer, compliance);
        MockRWAOracle sourceOracle = new MockRWAOracle(deployer);
        OracleAdapter oracleAdapter = new OracleAdapter(deployer);
        RWARegistry registry = new RWARegistry(deployer);
        RWARiskEngine riskEngine = new RWARiskEngine(registry);
        USDCLiquidityVault liquidityVault = new USDCLiquidityVault(usdc, deployer);
        RWACreditVault creditVault =
            new RWACreditVault(deployer, registry, riskEngine, liquidityVault, usdc);

        liquidityVault.grantRole(liquidityVault.CREDIT_VAULT_ROLE(), address(creditVault));
        oracleAdapter.setSource(address(tbill), address(sourceOracle));
        compliance.setEligibility(address(tbill), address(creditVault), true);
        compliance.setEligibility(address(tbill), borrower, true);

        registry.setAssetConfig(
            address(tbill),
            IRWARegistry.AssetConfig({
                oracle: address(oracleAdapter),
                complianceAdapter: address(compliance),
                baseLtvBps: 7_500,
                liquidationLtvBps: 8_200,
                liquidityFactorBps: 9_000,
                settlementFactorBps: 9_500,
                maxOracleAge: 24 hours,
                hardStaleAge: 72 hours,
                redemptionDelay: 1 days,
                supplyCap: uint128(1_000_000e18),
                permissioned: true,
                borrowingEnabled: true,
                enabled: true
            })
        );

        sourceOracle.setCurrentPrice(address(tbill), 1.05e18);
        usdc.mint(lender, 100_000e6);
        tbill.mint(borrower, 100_000e18);

        vm.stopBroadcast();

        _writeDeployment(
            deploymentBlock,
            deployer,
            usdc,
            tbill,
            compliance,
            sourceOracle,
            oracleAdapter,
            registry,
            riskEngine,
            liquidityVault,
            creditVault
        );
    }

    function _writeDeployment(
        uint256 deploymentBlock,
        address deployer,
        MockUSDC usdc,
        MockTBILL tbill,
        ComplianceRegistry compliance,
        MockRWAOracle sourceOracle,
        OracleAdapter oracleAdapter,
        RWARegistry registry,
        RWARiskEngine riskEngine,
        USDCLiquidityVault liquidityVault,
        RWACreditVault creditVault
    ) private {
        string memory objectKey = "yieldline";
        vm.serializeUint(objectKey, "chainId", block.chainid);
        vm.serializeUint(objectKey, "deploymentBlock", deploymentBlock);
        vm.serializeUint(objectKey, "timestamp", block.timestamp);
        vm.serializeAddress(objectKey, "deployer", deployer);
        vm.serializeAddress(objectKey, "mockUSDC", address(usdc));
        vm.serializeAddress(objectKey, "mockTBILL", address(tbill));
        vm.serializeAddress(objectKey, "complianceRegistry", address(compliance));
        vm.serializeAddress(objectKey, "mockOracle", address(sourceOracle));
        vm.serializeAddress(objectKey, "oracleAdapter", address(oracleAdapter));
        vm.serializeAddress(objectKey, "registry", address(registry));
        vm.serializeAddress(objectKey, "riskEngine", address(riskEngine));
        vm.serializeAddress(objectKey, "liquidityVault", address(liquidityVault));
        string memory json = vm.serializeAddress(objectKey, "creditVault", address(creditVault));

        string memory file =
            block.chainid == ARBITRUM_SEPOLIA ? "arbitrum-sepolia.json" : "anvil.json";
        vm.writeJson(json, string.concat(vm.projectRoot(), "/../deployments/", file));
    }
}
