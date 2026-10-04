import type { Metadata } from "next";

import { LendView } from "@/components/views/lend-view";

export const metadata: Metadata = { title: "Lend" };

export default function LendPage() {
  return <LendView />;
}
