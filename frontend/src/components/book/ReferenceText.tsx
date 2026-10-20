import { referenceRuns } from "@/lib/references/apa";
import type { ReferenceData } from "@/lib/types";

/** Referencia en formato APA 7, con la cursiva donde corresponde. */
export function ReferenceText({ reference }: { reference: ReferenceData }) {
  return (
    <>
      {referenceRuns(reference).map((run, i) => (run.italic ? <em key={i}>{run.text}</em> : <span key={i}>{run.text}</span>))}
    </>
  );
}
