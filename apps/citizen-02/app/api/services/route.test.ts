// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/service-data", () => ({
  getAllServices: vi.fn(),
}));

import { GET } from "./route";
import { getAllServices } from "@/lib/service-data";

const mockedGetAllServices = vi.mocked(getAllServices);

describe("GET /api/services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns mapped service list", async () => {
    mockedGetAllServices.mockResolvedValue([
      {
        id: "renew-driving-licence",
        name: "Renew Driving Licence",
        description: "Renew your licence",
        department: "DVLA",
        promoted: true,
        source: "full",
        serviceType: "obligation",
        govuk_url: "https://gov.uk/renew",
        eligibility_summary: "All drivers",
        proactive: false,
        gated: true,
      },
    ] as never[]);

    const response = await GET();
    const data = await response.json();

    expect(data.services).toHaveLength(1);
    expect(data.services[0]).toEqual({
      id: "renew-driving-licence",
      name: "Renew Driving Licence",
      description: "Renew your licence",
      department: "DVLA",
      promoted: true,
      source: "full",
      serviceType: "obligation",
      govuk_url: "https://gov.uk/renew",
      eligibility_summary: "All drivers",
      proactive: false,
      gated: true,
    });
  });

  it("returns 500 on error", async () => {
    mockedGetAllServices.mockRejectedValue(new Error("DB error"));

    const response = await GET();
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBe("Failed to load services");
  });
});
