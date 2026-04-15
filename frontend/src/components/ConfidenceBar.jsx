export default function ConfidenceBar({ confidence }) {
  const pct = Math.round(confidence * 100);
  let barColor = "bg-red-500";
  if (pct >= 80) barColor = "bg-green-500";
  else if (pct >= 50) barColor = "bg-yellow-500";

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-600 w-8">{pct}%</span>
    </div>
  );
}
