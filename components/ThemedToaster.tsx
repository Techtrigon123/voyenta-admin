"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/lib/theme";

export default function ThemedToaster() {
  const theme = useTheme();
  return <Toaster theme={theme} position="top-right" richColors closeButton />;
}
