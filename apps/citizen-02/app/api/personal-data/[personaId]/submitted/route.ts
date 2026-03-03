import { NextRequest, NextResponse } from "next/server";
import { getSubmittedStore, getServiceAccessStore, getPersonalDataAdapter } from "@/lib/personal-data-store";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  const { personaId } = await params;

  try {
    const body = await request.json();
    const { fieldKey, fieldValue, category, source } = body;

    if (!fieldKey || fieldValue === undefined || !category) {
      return NextResponse.json(
        { error: "Missing required fields: fieldKey, fieldValue, category" },
        { status: 400 }
      );
    }

    const submittedStore = await getSubmittedStore();
    const accessStore = await getServiceAccessStore();
    const db = await getPersonalDataAdapter();

    // Get old value for update log
    const existing = await submittedStore.get(personaId, fieldKey);
    const oldValue = existing ? existing.fieldValue : null;

    // Upsert the field
    const updated = await submittedStore.upsert(personaId, {
      fieldKey,
      fieldValue,
      category,
      source: source || "user_edit",
    });

    // Find services with access to this field and log the update
    const servicesWithAccess = await accessStore.getFieldAccess(personaId, fieldKey);
    const servicesNotified = servicesWithAccess.map(g => g.serviceId);

    // Log the update
    const updateId = `upd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await db.run(
      `INSERT INTO data_updates (id, user_id, field_key, old_value, new_value, update_type, services_notified, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      updateId, personaId, fieldKey, JSON.stringify(oldValue), JSON.stringify(fieldValue), "edit", JSON.stringify(servicesNotified), new Date().toISOString()
    );

    return NextResponse.json({
      field: updated,
      cascadedTo: servicesNotified,
    });
  } catch (error) {
    console.error("[PersonalData] PUT submitted error:", error);
    return NextResponse.json(
      { error: "Failed to update field" },
      { status: 500 }
    );
  }
}
