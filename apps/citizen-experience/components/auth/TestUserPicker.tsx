"use client";

import { useState, useEffect } from "react";

interface TestUser {
  id: string;
  name: string;
  date_of_birth: string;
  age: number;
  address: { city: string; postcode: string };
  employment_status: string;
  credentials: Array<{ type: string; status: string }>;
}

interface TestUserPickerProps {
  onSelect: (userId: string) => void;
}

export default function TestUserPicker({ onSelect }: TestUserPickerProps) {
  const [users, setUsers] = useState<TestUser[]>([]);

  useEffect(() => {
    fetch("/api/auth/test-users")
      .then((r) => r.json())
      .then((data) => setUsers(data.users || []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 mb-4">
        Select a test identity to simulate signing in with GOV.UK One Login.
        This is a simulation — no real authentication occurs.
      </p>

      {users.map((user) => (
        <button
          key={user.id}
          onClick={() => onSelect(user.id)}
          className="w-full text-left p-4 border-2 border-gray-300 rounded hover:border-govuk-blue hover:bg-blue-50 transition-colors"
        >
          <div className="font-bold text-lg">{user.name}</div>
          <div className="text-sm text-gray-600 mt-1">
            Age {user.age} · {user.address.city}, {user.address.postcode}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {user.employment_status} · {user.credentials.length} credential(s)
          </div>
        </button>
      ))}

      {users.length === 0 && (
        <div className="text-center text-gray-400 py-8">Loading test users...</div>
      )}
    </div>
  );
}
