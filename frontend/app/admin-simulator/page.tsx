import type { Metadata } from "next";

import { AdminView } from "@/components/views/admin-view";

export const metadata: Metadata = { title: "Admin simulator" };

export default function AdminSimulatorPage() {
  return <AdminView />;
}
