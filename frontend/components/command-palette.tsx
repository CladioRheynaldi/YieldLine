"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const commands = [
  { label: "Open dashboard", detail: "Protocol overview", href: "/" },
  { label: "Open borrow workbench", detail: "Deposit, borrow, repay", href: "/borrow" },
  { label: "Open lender pool", detail: "Supply and withdraw liquidity", href: "/lend" },
  { label: "Inspect MockTBILL", detail: "Market configuration", href: "/markets" },
  { label: "Inspect position", detail: "Health and settlement state", href: "/position" },
  { label: "Run risk simulator", detail: "Workshop admin controls", href: "/admin-simulator" },
] as const;

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.detail}`.toLowerCase().includes(needle),
    );
  }, [query]);
  const selectedIndex = Math.min(activeIndex, Math.max(results.length - 1, 0));

  const open = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    setQuery("");
    setActiveIndex(0);
    dialog.showModal();
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const close = useCallback(() => dialogRef.current?.close(), []);

  const choose = useCallback(
    (href: string) => {
      close();
      if (href !== pathname) router.push(href);
    },
    [close, pathname, router],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (dialogRef.current?.open) close();
        else open();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  return (
    <>
      <button
        aria-label="Open command palette"
        className="search-pill"
        type="button"
        onClick={open}
      >
        <Search aria-hidden="true" size={16} strokeWidth={1.8} />
        <span className="search-pill__label">Jump to a flow</span>
        <kbd>Ctrl K</kbd>
      </button>

      <dialog
        className="command-dialog"
        ref={dialogRef}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        onClose={() => {
          setQuery("");
          setActiveIndex(0);
        }}
      >
        <div className="command-dialog__panel">
          <label className="command-dialog__search">
            <Search aria-hidden="true" size={18} strokeWidth={1.8} />
            <span className="sr-only">Search YieldLine flows</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((index) => (index + 1) % Math.max(results.length, 1));
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex(
                    (index) => (index - 1 + Math.max(results.length, 1)) % Math.max(results.length, 1),
                  );
                }
                if (event.key === "Enter" && results[selectedIndex]) {
                  event.preventDefault();
                  choose(results[selectedIndex].href);
                }
              }}
              placeholder="Search flows…"
              type="search"
            />
            <kbd>Esc</kbd>
          </label>

          <div className="command-dialog__results" aria-live="polite">
            <p>{results.length} destinations</p>
            {results.map((command, index) => (
              <button
                className="command-item"
                data-active={index === selectedIndex}
                key={command.href}
                onClick={() => choose(command.href)}
                onMouseEnter={() => setActiveIndex(index)}
                type="button"
              >
                <span>{command.label}</span>
                <small>{command.detail}</small>
              </button>
            ))}
            {results.length === 0 ? (
              <div className="command-empty">
                <strong>No matching flow.</strong>
                <span>Try “borrow”, “market”, or “simulator”.</span>
              </div>
            ) : null}
          </div>
        </div>
      </dialog>
    </>
  );
}
