"use client";

import { Shield, Briefcase, MapPin } from "lucide-react";

interface PersonaCardUser {
  id: string;
  name: string;
  personaName: string;
  description: string;
  age: number;
  address: { city: string; postcode: string };
  employment_status: string;
  credentialCount: number;
  income: number;
  savings: number;
}

const EMPLOYMENT_COLORS: Record<string, string> = {
  employed: "bg-green-100 text-green-800",
  "self-employed": "bg-blue-100 text-blue-800",
  unemployed: "bg-orange-100 text-orange-800",
  retired: "bg-purple-100 text-purple-800",
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function avatarColor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function PersonaCard({ user }: { user: PersonaCardUser }) {
  const empStyle = EMPLOYMENT_COLORS[user.employment_status] ?? "bg-gray-100 text-gray-700";

  return (
    <a
      href={`/personas/${user.id}`}
      className="block border border-studio-border rounded-xl bg-white hover:shadow-md transition-shadow"
    >
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${avatarColor(user.id)}`}
          >
            {initials(user.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate">{user.personaName}</h3>
            <p className="text-xs text-gray-500">Age {user.age}</p>
          </div>
        </div>

        {/* Description */}
        {user.description && (
          <p className="text-xs text-gray-500 mb-3 line-clamp-2">{user.description}</p>
        )}

        {/* Details */}
        <div className="space-y-2 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <MapPin size={13} className="text-gray-400 flex-shrink-0" />
            <span>
              {user.address.city}, {user.address.postcode}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase size={13} className="text-gray-400 flex-shrink-0" />
            <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${empStyle}`}>
              {user.employment_status}
            </span>
            {user.income > 0 && (
              <span className="text-gray-400">
                {"\u00A3"}
                {user.income.toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Shield size={13} className="text-gray-400 flex-shrink-0" />
            <span>
              {user.credentialCount} credential{user.credentialCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}
