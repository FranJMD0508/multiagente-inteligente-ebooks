"use client";

import { Tooltip as RTooltip } from "radix-ui";

export const TooltipProvider = RTooltip.Provider;

export function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactNode }) {
  return (
    <RTooltip.Root delayDuration={250}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          sideOffset={8}
          className="z-50 max-w-[260px] rounded-lg bg-[#1b1d23] px-3 py-2 text-[12.5px] leading-snug text-white shadow-lg data-[state=delayed-open]:animate-[fundido_120ms_ease-out] motion-reduce:animate-none"
        >
          {content}
          <RTooltip.Arrow className="fill-[#1b1d23]" />
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}
