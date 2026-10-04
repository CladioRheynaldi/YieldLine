import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>YieldLine · workshop prototype</span>
      <span>Arbitrum Sepolia · mock assets only</span>
      <Link href="/admin-simulator">Open simulator</Link>
    </footer>
  );
}
