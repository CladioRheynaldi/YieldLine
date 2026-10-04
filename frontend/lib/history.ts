import { parseAbi, type Address, type Hash, type PublicClient } from "viem";

export const historyEvents = parseAbi([
  "event CollateralDeposited(address indexed borrower,address indexed asset,uint256 amount)",
  "event CollateralWithdrawn(address indexed borrower,address indexed asset,uint256 amount)",
  "event Borrowed(address indexed borrower,address indexed asset,uint256 amount,uint256 debtAfter)",
  "event Repaid(address indexed borrower,address indexed asset,uint256 amount,uint256 debtAfter)",
  "event LiquidationInitiated(address indexed borrower,address indexed asset,uint256 collateralAmount,uint256 debtAmount)",
  "event LiquidationSettled(address indexed borrower,address indexed asset,uint256 settlementAmount,uint256 debtRepaid,uint256 surplus,uint256 badDebt)",
]);
export const poolEvents = parseAbi([
  "event Deposit(address indexed sender,address indexed owner,uint256 assets,uint256 shares)",
  "event Withdraw(address indexed sender,address indexed receiver,address indexed owner,uint256 assets,uint256 shares)",
  "event Transfer(address indexed from,address indexed to,uint256 value)",
]);

export type Activity = {
  id: string;
  event: string;
  label: string;
  amount: bigint;
  decimals: number;
  unit: string;
  blockNumber: bigint;
  hash: Hash;
  logIndex: number;
  timestamp: bigint | null;
  args: Record<string, unknown>;
};
export type HistoryPage = {
  rows: Activity[];
  fromBlock: bigint;
  toBlock: bigint;
  nextBlock: bigint | null;
};

const labels: Record<string, string> = {
  CollateralDeposited: "Collateral deposit",
  CollateralWithdrawn: "Collateral withdrawal",
  Borrowed: "Borrow",
  Repaid: "Repayment",
  LiquidationInitiated: "Liquidation initiated",
  LiquidationSettled: "Liquidation settled",
  Deposit: "Liquidity supplied",
  Withdraw: "Liquidity withdrawn",
  Transfer: "Lender shares transferred",
};
const matches = (value: unknown, account: Address) =>
  typeof value === "string" && value.toLowerCase() === account.toLowerCase();
const amount = (value: unknown) => typeof value === "bigint" ? value : 0n;
const zero = "0x0000000000000000000000000000000000000000";

export async function readHistoryPage(
  client: PublicClient,
  contracts: { creditVault: Address; liquidityVault: Address },
  account: Address,
  deploymentBlock: bigint,
  cursor?: bigint,
): Promise<HistoryPage> {
  const latest = await client.getBlockNumber({ cacheTime: 0 });
  if (latest < deploymentBlock) throw new Error("The local chain was reset. Redeploy YieldLine and synchronize its addresses.");
  const toBlock = cursor === undefined || cursor > latest ? latest : cursor;
  const fromBlock = toBlock > deploymentBlock + 9_999n ? toBlock - 9_999n : deploymentBlock;
  const rows: Activity[] = [];

  // Split rejected ranges instead of accepting a truncated or partial page.
  async function logs(from: bigint, to: bigint): Promise<void> {
    try {
      const [credit, pool] = await Promise.all([
        client.getLogs({ address: contracts.creditVault, events: historyEvents, fromBlock: from, toBlock: to, strict: true }),
        client.getLogs({ address: contracts.liquidityVault, events: poolEvents, fromBlock: from, toBlock: to, strict: true }),
      ]);
      for (const log of [...credit, ...pool]) {
        if (log.removed || log.blockNumber === null || !log.transactionHash || log.logIndex === null) continue;
        const args = log.args as Record<string, unknown>;
        const event = log.eventName!;
        const isTransfer = event === "Transfer";
        if (isTransfer) {
          if (args.from === zero || args.to === zero || args.from === args.to) continue;
          if (!matches(args.from, account) && !matches(args.to, account)) continue;
        } else if (!matches(args.borrower ?? args.owner, account)) continue;
        const collateral = event === "CollateralDeposited" || event === "CollateralWithdrawn";
        rows.push({
          id: log.transactionHash + ":" + log.logIndex,
          event, label: labels[event] ?? event,
          amount: amount(args.amount ?? args.assets ?? args.settlementAmount ?? args.debtAmount ?? args.value),
          decimals: collateral ? 18 : isTransfer ? 9 : 6,
          unit: collateral ? "mTBILL" : isTransfer ? "ylmUSDC" : "mUSDC",
          blockNumber: log.blockNumber, hash: log.transactionHash,
          logIndex: log.logIndex, timestamp: null, args,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (from === to || !/range|too many|limit|response size|exceed/i.test(message)) throw error;
      const middle = (from + to) / 2n;
      await logs(from, middle);
      await logs(middle + 1n, to);
    }
  }
  for (let start = fromBlock; start <= toBlock; start += 2_000n) {
    await logs(start, start + 1_999n < toBlock ? start + 1_999n : toBlock);
  }
  // Timestamp failure does not remove confirmed event records.
  const blocks = [...new Set(rows.map(r => r.blockNumber))];
  const timestamps = new Map<bigint, bigint>();
  for (let i = 0; i < blocks.length; i += 8) {
    const batch = blocks.slice(i, i + 8);
    const results = await Promise.allSettled(batch.map(blockNumber => client.getBlock({ blockNumber })));
    results.forEach((r, index) => {
      if (r.status === "fulfilled") timestamps.set(batch[index], r.value.timestamp);
    });
  }
  for (const row of rows) row.timestamp = timestamps.get(row.blockNumber) ?? null;
  rows.sort((a,b) => a.blockNumber === b.blockNumber ? b.logIndex-a.logIndex : a.blockNumber > b.blockNumber ? -1 : 1);
  return { rows, fromBlock, toBlock, nextBlock: fromBlock > deploymentBlock ? fromBlock - 1n : null };
}

export function lenderCashFlows(rows: Activity[], complete: boolean, shareValue: bigint) {
  if (!complete || rows.some(row => row.event === "Transfer")) return null;
  const deposits = rows.filter(r => r.event === "Deposit").reduce((sum,r) => sum + amount(r.args.assets), 0n);
  const withdrawals = rows.filter(r => r.event === "Withdraw").reduce((sum,r) => sum + amount(r.args.assets), 0n);
  return { deposits, withdrawals, netResult: shareValue + withdrawals - deposits };
}

/** Gross lifetime interest, including paid/written-off interest and base-unit loan rounding. */
export function borrowerInterest(rows: Activity[], complete: boolean, currentDebt: bigint) {
  if (!complete) return null;
  let debt = 0n;
  let interest = 0n;
  const ordered = [...rows].sort((a,b) => a.blockNumber === b.blockNumber ? a.logIndex-b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1);
  for (const row of ordered) {
    let before: bigint | undefined;
    let after: bigint | undefined;
    if (row.event === "Borrowed") {
      after = amount(row.args.debtAfter);
      before = after - amount(row.args.amount);
    } else if (row.event === "Repaid") {
      after = amount(row.args.debtAfter);
      before = after + amount(row.args.amount);
    } else if (row.event === "LiquidationInitiated") {
      before = amount(row.args.debtAmount);
      after = before;
    } else if (row.event === "LiquidationSettled") {
      before = amount(row.args.debtRepaid) + amount(row.args.badDebt);
      after = 0n;
    }
    if (before === undefined || after === undefined) continue;
    if (before < debt) return null;
    interest += before-debt;
    debt = after;
  }
  if (currentDebt < debt) return null; // history/state snapshots not yet synchronized
  return interest + currentDebt-debt;
}
