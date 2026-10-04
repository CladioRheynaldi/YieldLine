import type { Metadata } from "next";

import { BorrowView } from "@/components/views/borrow-view";

export const metadata: Metadata = { title: "Borrow" };

export default function BorrowPage() {
  return <BorrowView />;
}
