export default function StudioHomePage() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-4">
        Legibility Studio
      </h1>
      <p className="text-lg text-govuk-dark-grey mb-6">
        Define, inspect, and publish government service capabilities for AI agents.
      </p>
      <p className="text-govuk-dark-grey mb-8">
        The Legibility Studio is where service designers author capability
        manifests, policy rulesets, state models, and consent models that make
        government services legible to AI agents.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="border border-govuk-mid-grey p-6">
          <h2 className="text-xl font-bold mb-2">Services</h2>
          <p className="text-govuk-dark-grey mb-4">
            Browse services, view operational ledgers, and manage capability manifests.
          </p>
          <a
            href="/services"
            className="inline-block bg-govuk-green text-govuk-white font-bold px-4 py-2 no-underline hover:bg-[#005a30]"
          >
            View services
          </a>
        </div>
        <div className="border border-govuk-mid-grey p-6">
          <h2 className="text-xl font-bold mb-2">Evidence</h2>
          <p className="text-govuk-dark-grey mb-4">
            Explore traces, receipts, and audit logs from agent interactions.
          </p>
          <a
            href="/evidence"
            className="inline-block bg-govuk-green text-govuk-white font-bold px-4 py-2 no-underline hover:bg-[#005a30]"
          >
            View evidence
          </a>
        </div>
        <div className="border border-govuk-mid-grey p-6">
          <h2 className="text-xl font-bold mb-2">Gap Analysis</h2>
          <p className="text-govuk-dark-grey mb-4">
            See which services have complete artefacts and where gaps exist.
          </p>
          <a
            href="/gap-analysis"
            className="inline-block bg-govuk-green text-govuk-white font-bold px-4 py-2 no-underline hover:bg-[#005a30]"
          >
            Run analysis
          </a>
        </div>
      </div>
    </div>
  );
}
