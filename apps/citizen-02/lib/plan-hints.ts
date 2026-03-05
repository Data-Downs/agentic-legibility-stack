import type { PersonaData, LifeEventService } from "./types";

export interface ServiceHint {
  message: string;
  uploadAvailable: boolean;
  uploadLabel: string;
  chatLabel: string;
}

/**
 * Check persona data against each service in a plan and return hints
 * for document-type services where the persona has relevant data.
 */
export function computeServiceHints(
  services: LifeEventService[],
  personaData: PersonaData | null
): Record<string, ServiceHint> {
  if (!personaData) return {};

  const hints: Record<string, ServiceHint> = {};

  for (const svc of services) {
    const hint = computeHintForService(svc, personaData);
    if (hint) {
      hints[svc.id] = hint;
    }
  }

  return hints;
}

function computeHintForService(
  svc: LifeEventService,
  personaData: PersonaData
): ServiceHint | null {
  // Only generate hints for document-type services
  if (svc.serviceType !== "document") return null;

  const employment = personaData.employment as
    | {
        status?: string;
        previousEmployer?: string;
        employmentEndDate?: string;
        endReason?: string;
      }
    | undefined;

  if (!employment) return null;

  // P45 hint: unemployed persona with previous employer likely has their P45
  if (
    svc.id === "hmrc-p45" &&
    employment.status === "Unemployed" &&
    employment.previousEmployer
  ) {
    const endDate = employment.employmentEndDate
      ? formatDate(employment.employmentEndDate)
      : null;

    const datePart = endDate ? ` on ${endDate}` : "";
    const message = `You left ${employment.previousEmployer}${datePart}. Your employer must issue a P45 when you leave a job.`;

    return {
      message,
      uploadAvailable: true,
      uploadLabel: "Upload my P45",
      chatLabel: "I need to request my P45",
    };
  }

  return null;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
