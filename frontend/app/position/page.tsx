import type { Metadata } from "next";

import { PositionView } from "@/components/views/position-view";

export const metadata: Metadata = { title: "Position" };

export default function PositionPage() {
  return <PositionView />;
}
