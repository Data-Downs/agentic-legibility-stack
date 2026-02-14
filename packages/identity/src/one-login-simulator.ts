/**
 * OneLoginSimulator — Simulates GOV.UK One Login authentication
 *
 * In production, this would be a real OIDC client talking to
 * the GOV.UK One Login service. Here we simulate the flow
 * with test users.
 */

import type { TestUser, IdentityContext } from "./credential-types";

function generateToken(): string {
  return `sim_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export class OneLoginSimulator {
  private testUsers: TestUser[] = [];
  private sessions = new Map<string, IdentityContext>();

  /** Load test users (call this with data from test-users.json) */
  loadTestUsers(users: TestUser[]): void {
    this.testUsers = users;
  }

  /** Get available test users for the picker */
  getAvailableUsers(): Array<{ id: string; name: string }> {
    return this.testUsers.map((u) => ({ id: u.id, name: u.name }));
  }

  /** Start an auth flow — returns a session token (simulated OIDC) */
  startAuthFlow(userId: string): { sessionToken: string; user: TestUser } | null {
    const user = this.testUsers.find((u) => u.id === userId);
    if (!user) return null;

    const sessionToken = generateToken();
    const context: IdentityContext = {
      authenticated: true,
      userId: user.id,
      name: user.name,
      verificationLevel: "high",
      authMethod: "simulated",
      sessionToken,
      claims: {
        full_name: user.name,
        date_of_birth: user.date_of_birth,
        national_insurance_number: user.national_insurance_number,
        address: user.address,
      },
    };

    this.sessions.set(sessionToken, context);
    return { sessionToken, user };
  }

  /** Complete the auth flow — validate a session token */
  completeAuth(sessionToken: string): IdentityContext | null {
    return this.sessions.get(sessionToken) || null;
  }

  /** Get user info from a session */
  getUserInfo(sessionToken: string): TestUser | null {
    const context = this.sessions.get(sessionToken);
    if (!context) return null;
    return this.testUsers.find((u) => u.id === context.userId) || null;
  }

  /** End a session */
  logout(sessionToken: string): void {
    this.sessions.delete(sessionToken);
  }

  /** Check if a session is valid */
  isAuthenticated(sessionToken: string): boolean {
    return this.sessions.has(sessionToken);
  }
}
