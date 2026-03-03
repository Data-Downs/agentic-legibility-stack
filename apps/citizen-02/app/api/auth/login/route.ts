import { NextRequest, NextResponse } from "next/server";
import { getOneLogin, getWallet } from "@/lib/identity";

/**
 * POST /api/auth/login
 *
 * Simulates GOV.UK One Login authentication.
 * Accepts a test user ID and returns a session token + user data.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const oneLogin = await getOneLogin();
    const result = oneLogin.startAuthFlow(userId);

    if (!result) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Also load wallet credentials
    const wallet = await getWallet();
    const credentials = wallet.getCredentials(userId);

    return NextResponse.json({
      sessionToken: result.sessionToken,
      user: {
        id: result.user.id,
        name: result.user.name,
        age: result.user.age,
        address: result.user.address,
        employment_status: result.user.employment_status,
        credentials,
      },
    });
  } catch (error) {
    console.error("Error in auth login:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
