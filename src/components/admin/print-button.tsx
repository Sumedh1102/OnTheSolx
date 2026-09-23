"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button variant="outline" icon={<Printer className="size-4" />} onClick={() => window.print()} data-print-hide>
      {label}
    </Button>
  );
}
