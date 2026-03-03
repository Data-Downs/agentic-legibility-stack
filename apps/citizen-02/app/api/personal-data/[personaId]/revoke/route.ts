import { NextRequest, NextResponse } from "next/server";
import { getServiceAccessStore } from "@/lib/personal-data-store";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  const { personaId } = await params;

  try {
    const body = await request.json();
    const { serviceId, fieldKey, grantId } = body;

    const accessStore = await getServiceAccessStore();

    let revokedCount = 0;

    if (grantId) {
      // Revoke a specific grant
      const revoked = await accessStore.revoke(grantId);
      revokedCount = revoked ? 1 : 0;
    } else if (serviceId && !fieldKey) {
      // Revoke all access for a service
      revokedCount = await accessStore.revokeByService(personaId, serviceId);
    } else if (fieldKey && !serviceId) {
      // Revoke all services' access to a field
      revokedCount = await accessStore.revokeByField(personaId, fieldKey);
    } else {
      return NextResponse.json(
        { error: "Provide one of: grantId, serviceId, or fieldKey" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      revokedCount,
    });
  } catch (error) {
    console.error("[PersonalData] POST revoke error:", error);
    return NextResponse.json(
      { error: "Failed to revoke access" },
      { status: 500 }
    );
  }
}
