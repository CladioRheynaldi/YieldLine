"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { Address } from "viem";

import { chain, deployment } from "./network";
import { readHistoryPage, type Activity } from "./history";

export function useHistory(account?: Address) {
  const client = usePublicClient({ chainId: chain.id });
  const d = deployment;
  const query = useInfiniteQuery({
    queryKey: ["protocol-history", chain.id, d?.creditVault, d?.liquidityVault, d?.deploymentBlock?.toString(), account],
    initialPageParam: undefined as bigint | undefined,
    queryFn: ({ pageParam }) => readHistoryPage(client!, d!, account!, d!.deploymentBlock!, pageParam),
    getNextPageParam: page => page.nextBlock ?? undefined,
    enabled: Boolean(client && d && account && d.deploymentBlock !== null),
    refetchInterval: 20_000,
    retry: 1,
  });
  const unique = new Map<string, Activity>();
  for (const page of query.data?.pages ?? []) for (const row of page.rows) unique.set(row.id, row);
  const rows = [...unique.values()].sort((a,b) => a.blockNumber === b.blockNumber ? b.logIndex-a.logIndex : a.blockNumber > b.blockNumber ? -1 : 1);
  return {
    ...query, rows,
    complete: Boolean(query.data?.pages.length && !query.hasNextPage && !query.isError),
    configured: Boolean(d && d.deploymentBlock !== null),
  };
}
