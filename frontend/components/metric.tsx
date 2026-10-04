import type { Tone } from "@/lib/use-protocol";

export function Metric({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: Tone;
}) {
  return (
    <div className="metric" data-tone={tone}>
      <span className="metric__label">{label}</span>
      <strong className="metric__value">{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}
