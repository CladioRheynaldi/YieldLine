import { formatUnits } from "viem";

const usdFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const amountFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const WAD = 10n ** 18n;
export const USDC_DECIMALS = 6;
export const TBILL_DECIMALS = 18;

/** 1e18-scaled USD value → "$89,775.00". */
export function formatUsdWad(value: bigint): string {
  return usdFormat.format(Number(formatUnits(value, 18)));
}

/** 6-decimal MockUSDC amount → "$50,000.00". */
export function formatUsdc(value: bigint): string {
  return usdFormat.format(Number(formatUnits(value, USDC_DECIMALS)));
}

export function formatToken(value: bigint, decimals: number, symbol?: string): string {
  const amount = amountFormat.format(Number(formatUnits(value, decimals)));
  return symbol ? `${amount} ${symbol}` : amount;
}

export function formatBps(value: bigint | number): string {
  return `${(Number(value) / 100).toFixed(2)}%`;
}

export function formatHealthFactor(value: bigint): string {
  if (value >= 2n ** 255n) return "∞";
  return Number(formatUnits(value, 18)).toFixed(4);
}

export function formatAge(seconds: number): string {
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
