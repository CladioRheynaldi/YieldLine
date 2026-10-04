import { createPublicClient, http } from "viem";
import { arbitrum } from "viem/chains";
import { readOpenEdenReference, type ReferenceSnapshot } from "@/lib/openeden";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cache: { until: number; data: ReferenceSnapshot } | undefined;

export async function GET() {
  if (!cache || Date.now() >= cache.until) {
    const client = createPublicClient({
      chain: arbitrum,
      transport: http(process.env.OPENEDEN_ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc", { timeout: 8_000, retryCount: 0 }),
    });
    const data = await readOpenEdenReference(client);
    cache = { until: Date.now() + (data.status === "unavailable" ? 10_000 : 60_000), data };
  }
  return Response.json(cache.data, { headers: { "Cache-Control": "no-store" } });
}
