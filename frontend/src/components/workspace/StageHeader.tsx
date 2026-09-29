import { Ribbon } from "@/components/book/Ribbon";

interface StageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  /** Muestra la cinta: es el turno del usuario. */
  turn?: boolean;
}

export function StageHeader({ title, subtitle, turn }: StageHeaderProps) {
  return (
    <div className="relative grid gap-1 pr-12">
      {turn && <Ribbon className="-top-[31px] right-0 sm:-top-[35px]" />}
      <h2 className="font-display text-[21px] font-medium leading-tight tracking-[-0.025em] sm:text-[23px]">{title}</h2>
      {subtitle && <p className="text-[14px] text-grafito">{subtitle}</p>}
    </div>
  );
}
