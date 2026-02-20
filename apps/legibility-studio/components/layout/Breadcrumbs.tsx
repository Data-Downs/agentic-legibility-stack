import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6" aria-label="Breadcrumb">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} className="text-gray-400" />}
            {isLast || !item.href ? (
              <span className={isLast ? "text-gray-900 font-medium" : ""}>{item.label}</span>
            ) : (
              <a href={item.href} className="text-studio-accent hover:underline">
                {item.label}
              </a>
            )}
          </span>
        );
      })}
    </nav>
  );
}
