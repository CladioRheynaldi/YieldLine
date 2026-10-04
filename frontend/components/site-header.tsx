import Link from "next/link";

import { CommandPalette } from "./command-palette";
import { NetworkChip } from "./network-chip";
import { WalletButton } from "./wallet-button";

const links = [
  { href: "/borrow", label: "Borrow" },
  { href: "/lend", label: "Lend" },
  { href: "/position", label: "Position" },
  { href: "/markets", label: "Markets" },
] as const;

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="wordmark" href="/" aria-label="YieldLine dashboard">
          <span className="wordmark__mark" aria-hidden="true" />
          YieldLine
        </Link>

        <CommandPalette />

        <nav className="primary-nav" aria-label="Primary navigation">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="site-header__actions">
          <NetworkChip />
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
