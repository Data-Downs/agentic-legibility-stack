import { NextRequest, NextResponse } from "next/server";
import { getGraphEngine } from "@/lib/service-data";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> },
) {
  const { serviceId } = await params;
  const engine = getGraphEngine();

  const enabled = engine.getEnabledServices(serviceId);

  const services = enabled.map((node) => ({
    id: node.id,
    name: node.name,
    dept: node.dept,
    serviceType: node.serviceType,
    desc: node.eligibility.summary || "",
  }));

  return NextResponse.json({ services });
}
