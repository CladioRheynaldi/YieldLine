import { parseAbi, type PublicClient } from "viem";

export const OPENEDEN_REFERENCE = {
  chainId: 42161,
  network: "Arbitrum One",
  vault: "0xF84D28A8D28292842dD73D1c5F99476A80b6666A",
  oracle: "0xc0952c8ba068c887B675B4182F3A65420D045F46",
  source: "https://docs.openeden.com/tbill/smart-contract-addresses",
  sourceChecked: "2026-10-04",
  implementation: "https://github.com/OpenEdenHQ/openeden.vault.audit",
} as const;

export const referenceVaultAbi = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function tbillUsdPriceFeed() view returns (address)",
]);
export const referenceOracleAbi = parseAbi([
  "function decimals() view returns (uint8)",
  "function latestRoundData() view returns (uint80,uint256,uint256,uint256,uint80)",
]);

export type ReferenceSnapshot = {
  status: "available" | "stale" | "unavailable";
  message: string;
  observedAt: string;
  blockNumber?: string;
  blockTimestamp?: string;
  symbol?: string;
  tokenDecimals?: number;
  totalSupply?: string;
  oracleDecimals?: number;
  nav?: string;
  oracleUpdatedAt?: string;
};

export async function readOpenEdenReference(client: PublicClient): Promise<ReferenceSnapshot> {
  const observedAt = new Date().toISOString();
  try {
    if (await client.getChainId() !== OPENEDEN_REFERENCE.chainId) throw new Error("Reference RPC is not Arbitrum One.");
    const block = await client.getBlock();
    const blockNumber = block.number!;
    const [symbol, tokenDecimals, totalSupply, oracle] = await Promise.all([
      client.readContract({ address: OPENEDEN_REFERENCE.vault, abi: referenceVaultAbi, functionName: "symbol", blockNumber }),
      client.readContract({ address: OPENEDEN_REFERENCE.vault, abi: referenceVaultAbi, functionName: "decimals", blockNumber }),
      client.readContract({ address: OPENEDEN_REFERENCE.vault, abi: referenceVaultAbi, functionName: "totalSupply", blockNumber }),
      client.readContract({ address: OPENEDEN_REFERENCE.vault, abi: referenceVaultAbi, functionName: "tbillUsdPriceFeed", blockNumber }),
    ]);
    if (oracle.toLowerCase() !== OPENEDEN_REFERENCE.oracle.toLowerCase()) throw new Error("The vault oracle differs from the documented address. Re-verify the integration.");
    const [oracleDecimals, round] = await Promise.all([
      client.readContract({ address: OPENEDEN_REFERENCE.oracle, abi: referenceOracleAbi, functionName: "decimals", blockNumber }),
      client.readContract({ address: OPENEDEN_REFERENCE.oracle, abi: referenceOracleAbi, functionName: "latestRoundData", blockNumber }),
    ]);
    const [roundId, nav, , updatedAt, answeredInRound] = round;
    if (symbol !== "TBILL" || tokenDecimals > 36 || oracleDecimals > 36 || nav === 0n || updatedAt === 0n || updatedAt > block.timestamp || answeredInRound < roundId) throw new Error("Reference metadata or oracle round is invalid.");
    const blockAge = Math.floor(Date.now()/1000) - Number(block.timestamp);
    const oldNav = block.timestamp - updatedAt > 72n*3600n;
    const stale = oldNav || blockAge > 120 || blockAge < -120;
    return {
      status: stale ? "stale" : "available",
      message: oldNav ? "NAV update is older than the 72-hour display threshold." : stale ? "RPC block timestamp is not current." : "Onchain production reference retrieved.",
      observedAt, blockNumber: blockNumber.toString(), blockTimestamp: block.timestamp.toString(),
      symbol, tokenDecimals, totalSupply: totalSupply.toString(), oracleDecimals,
      nav: nav.toString(), oracleUpdatedAt: updatedAt.toString(),
    };
  } catch {
    // Never serialize a provider error that may contain a private RPC URL/key.
    return { status: "unavailable", observedAt, message: "Production reference unavailable: RPC, address verification, metadata, or oracle validation failed. No mock fallback is shown." };
  }
}
