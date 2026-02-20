const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  "in-progress": { label: "In progress", color: "bg-blue-100 text-blue-800" },
  completed: { label: "Completed", color: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800" },
  "handed-off": { label: "Handed off", color: "bg-yellow-100 text-yellow-800" },
  abandoned: { label: "Abandoned", color: "bg-gray-100 text-gray-600" },
};

export default function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.abandoned;
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${style.color}`}>
      {style.label}
    </span>
  );
}
