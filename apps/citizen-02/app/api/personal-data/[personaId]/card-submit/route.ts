import { NextRequest, NextResponse } from "next/server";
import { getSubmittedStore, getPersonalDataAdapter } from "@/lib/personal-data-store";
import type { CardSubmission } from "@als/schemas";

/**
 * POST /api/personal-data/[personaId]/card-submit
 *
 * Receives a CardSubmission from the CardHost component.
 * Writes each field to submitted_data (Tier 2) and logs the update.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  const { personaId } = await params;

  try {
    const body: CardSubmission = await request.json();
    const { cardType, serviceId, stateId, fields } = body;

    if (!cardType || !fields || typeof fields !== "object") {
      return NextResponse.json(
        { error: "Missing required fields: cardType, fields" },
        { status: 400 }
      );
    }

    const submittedStore = await getSubmittedStore();
    const db = await getPersonalDataAdapter();
    let fieldsWritten = 0;

    for (const [fieldKey, fieldValue] of Object.entries(fields)) {
      if (fieldValue === undefined || fieldValue === null || fieldValue === "") continue;

      // Determine category from the card type
      const category = inferCategory(cardType, fieldKey);

      await submittedStore.upsert(personaId, {
        fieldKey,
        fieldValue,
        category,
        source: `card:${cardType}`,
      });

      // Log the update
      const updateId = `upd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await db.run(
        `INSERT INTO data_updates (id, user_id, field_key, old_value, new_value, update_type, services_notified, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        updateId,
        personaId,
        fieldKey,
        JSON.stringify(null),
        JSON.stringify(fieldValue),
        "card_submit",
        JSON.stringify([serviceId]),
        new Date().toISOString()
      );

      fieldsWritten++;
    }

    return NextResponse.json({
      success: true,
      fieldsWritten,
      cardType,
      serviceId,
      stateId,
    });
  } catch (error) {
    console.error("[PersonalData] POST card-submit error:", error);
    return NextResponse.json(
      { error: "Failed to submit card data" },
      { status: 500 }
    );
  }
}

/** Map card type + field key to a submitted_data category */
function inferCategory(cardType: string, fieldKey: string): string {
  const CARD_CATEGORIES: Record<string, string> = {
    "household-details": "housing",
    "financial-details": "financial",
    "bank-account-selector": "financial",
    "license-details": "licence",
    "payment-card": "payment",
    "payment-amount": "payment",
    "registration-details": "registration",
    "portal-action": "portal",
    "change-of-circumstances": "portal",
    "slot-picker": "appointment",
    "checklist-progress": "task_list",
    "decision-helper": "informational",
  };

  const FIELD_CATEGORIES: Record<string, string> = {
    tenure_type: "housing",
    monthly_rent: "housing",
    employment_status: "employment",
    monthly_income: "financial",
    savings_amount: "financial",
    bank_name: "financial",
    sort_code: "financial",
    account_number: "financial",
  };

  return FIELD_CATEGORIES[fieldKey] || CARD_CATEGORIES[cardType] || "other";
}
