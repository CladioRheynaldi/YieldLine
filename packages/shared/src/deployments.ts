import { anvilRecord, arbitrumSepoliaRecord } from "./generated/deployments";

export type Address = `0x${string}`;

export type DeploymentRecord = {
  chainId: number;
  deploymentBlock: bigint | null;
  deployer: Address | null;
  mockUSDC: Address | null;
  mockTBILL: Address | null;
  complianceRegistry: Address | null;
  mockOracle: Address | null;
  oracleAdapter: Address | null;
  registry: Address | null;
  riskEngine: Address | null;
  liquidityVault: Address | null;
  creditVault: Address | null;
};

type ContractKey = Exclude<keyof DeploymentRecord, "chainId" | "deploymentBlock">;

export type LiveDeployment = Omit<DeploymentRecord, ContractKey> & Record<ContractKey, Address>;

export type YieldLineNetwork = "arbitrumSepolia" | "anvil";

export const deploymentRecords: Record<YieldLineNetwork, DeploymentRecord | null> = {
  arbitrumSepolia: arbitrumSepoliaRecord,
  anvil: anvilRecord,
};

const contractKeys: ContractKey[] = [
  "deployer",
  "mockUSDC",
  "mockTBILL",
  "complianceRegistry",
  "mockOracle",
  "oracleAdapter",
  "registry",
  "riskEngine",
  "liquidityVault",
  "creditVault",
];

export function isLiveDeployment(record: DeploymentRecord | null): record is LiveDeployment {
  return Boolean(record && record.deploymentBlock !== null && record.deploymentBlock >= 0n &&
    contractKeys.every(key => /^0x[0-9a-fA-F]{40}$/.test(record[key] ?? "") &&
      record[key] !== "0x0000000000000000000000000000000000000000"));
}

export function getLiveDeployment(network: YieldLineNetwork): LiveDeployment | null {
  const record = deploymentRecords[network];
  const expectedChainId = network === "anvil" ? 31337 : 421614;
  return isLiveDeployment(record) && record.chainId === expectedChainId ? record : null;
}
