interface Props {
  value: number;
  max: number;
}

export default function ProgressBar({ value, max }: Props) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="w-full bg-slate-800 rounded-full h-2">
      <div
        className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
