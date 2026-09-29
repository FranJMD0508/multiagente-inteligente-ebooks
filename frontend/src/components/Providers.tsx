"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import { Announcer } from "@/components/ui/Announcer";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { AuthProvider } from "@/lib/auth";
import { PrefsProvider, usePrefs } from "@/lib/prefs";

function Motion({ children }: { children: React.ReactNode }) {
  const { prefs } = usePrefs();
  return <MotionConfig reducedMotion={prefs.reduceMotion ? "always" : "user"}>{children}</MotionConfig>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange>
      <PrefsProvider>
        <AuthProvider>
          <TooltipProvider>
            <Motion>
              {children}
              <Announcer />
            </Motion>
          </TooltipProvider>
        </AuthProvider>
      </PrefsProvider>
    </ThemeProvider>
  );
}
