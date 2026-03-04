import { NextRequest, NextResponse } from "next/server";
import { getUser, updateUser, getWalletCredentialTypes } from "@/lib/persona-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;

  try {
    const user = await getUser(userId);
    if (!user) {
      return NextResponse.json({ error: `User "${userId}" not found` }, { status: 404 });
    }

    const credentialTypes = await getWalletCredentialTypes();

    return NextResponse.json({ user, credentialTypes });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load user" },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;

  try {
    const body = await req.json();
    const { user: userUpdates } = body;

    const existing = await getUser(userId);
    if (!existing) {
      return NextResponse.json({ error: `User "${userId}" not found` }, { status: 404 });
    }

    if (userUpdates) {
      // Preserve the ID — don't allow overwriting it
      await updateUser(userId, { ...userUpdates, id: userId });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update" },
      { status: 500 },
    );
  }
}
