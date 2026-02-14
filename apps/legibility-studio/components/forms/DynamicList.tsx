"use client";

interface DynamicListProps<T> {
  items: T[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, item: T) => void;
  renderItem: (item: T, index: number, onChange: (item: T) => void) => React.ReactNode;
  addLabel?: string;
}

export default function DynamicList<T>({
  items,
  onAdd,
  onRemove,
  onChange,
  renderItem,
  addLabel = "Add item",
}: DynamicListProps<T>) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="border border-govuk-mid-grey rounded p-3 bg-white relative">
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute top-2 right-2 text-xs text-red-600 hover:text-red-800"
          >
            Remove
          </button>
          {renderItem(item, i, (updated) => onChange(i, updated))}
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="text-sm text-govuk-blue hover:underline"
      >
        + {addLabel}
      </button>
    </div>
  );
}
