"use client";

import { Switch as RSwitch } from "radix-ui";

interface SwitchProps {
  id?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}

export function Switch({ id, checked, onChange, label }: SwitchProps) {
  return (
    <RSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      className="relative h-6 w-11 flex-none rounded-full bg-borde-control transition-colors data-[state=checked]:bg-tinta"
    >
      <RSwitch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
    </RSwitch.Root>
  );
}
