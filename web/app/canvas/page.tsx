import type { Metadata } from "next";

import { CanvasClient } from "@/components/canvas/CanvasClient";

export const metadata: Metadata = {
  title: "Canvas — Poppy Clone",
};

export default function CanvasPage() {
  return <CanvasClient />;
}
