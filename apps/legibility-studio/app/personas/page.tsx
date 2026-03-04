"use client";

import { useState, useEffect } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import KPICard from "@/components/ui/KPICard";
import PersonaCard from "@/components/personas/PersonaCard";
import { Plus } from "lucide-react";

interface PersonaSummary {
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

export default function PersonasPage() {
  const [users, setUsers] = useState<PersonaSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/personas")
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const totalCredentials = users.reduce((sum, u) => sum + u.credentialCount, 0);

  return (
    <>
      <Breadcrumbs items={[{ label: "Personas" }]} />
      <PageHeader
        title="Test Personas"
        subtitle="View and edit unified user identities used in citizen simulations."
        actions={
          <a
            href="/personas/new"
            className="flex items-center gap-2 px-4 py-2 text-sm bg-studio-accent text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            Add Persona
          </a>
        }
      />

      {loading ? (
        <p className="text-sm text-gray-400 mt-8">Loading personas...</p>
      ) : (
        <>
          {/* KPI summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <KPICard label="Users" value={users.length} />
            <KPICard label="Total Credentials" value={totalCredentials} />
          </div>

          {/* Info banner */}
          <div className="border border-blue-200 rounded-lg bg-blue-50 px-4 py-3 mb-6">
            <p className="text-xs text-blue-800">
              Changes to persona data require restarting the citizen-experience dev server to take
              effect in the chat UI.
            </p>
          </div>

          {/* User cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((user) => (
              <PersonaCard key={user.id} user={user} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
