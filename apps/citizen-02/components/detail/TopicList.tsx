"use client";

import { useAppStore } from "@/lib/store";

interface Topic {
  id: string;
  label: string;
  questions: string[];
}

const SERVICE_TOPICS: Record<string, Topic[]> = {
  benefits: [
    { id: "uc", label: "Universal Credit", questions: [
      "Am I eligible for Universal Credit?",
      "How do I make a Universal Credit claim?",
      "What happens at my first work coach appointment?",
    ]},
    { id: "disability", label: "Disability benefits", questions: [
      "What disability benefits am I entitled to?",
      "How do I apply for PIP?",
      "What's the difference between PIP and DLA?",
    ]},
    { id: "housing", label: "Housing benefit", questions: [
      "Am I eligible for Housing Benefit?",
      "How do I apply for council tax reduction?",
      "What help is available with energy bills?",
    ]},
    { id: "bereavement", label: "Bereavement benefits", questions: [
      "What benefits can I claim after a bereavement?",
      "How do I apply for Bereavement Support Payment?",
      "Do I need to report a death to DWP?",
    ]},
  ],
  business: [
    { id: "setup", label: "Setting up a business", questions: [
      "How do I register as a sole trader?",
      "What's the difference between sole trader and limited company?",
      "How do I register for VAT?",
    ]},
    { id: "biztax", label: "Business tax", questions: [
      "When do I need to file a self-assessment return?",
      "How do I pay Corporation Tax?",
      "What business expenses can I claim?",
    ]},
    { id: "bizrates", label: "Business rates & licences", questions: [
      "How are business rates calculated?",
      "Am I eligible for small business rate relief?",
      "What licences does my business need?",
    ]},
  ],
  care: [
    { id: "socialcare", label: "Adult social care", questions: [
      "How do I get a care needs assessment?",
      "What is the means test for social care?",
      "How do I arrange care for an elderly relative?",
    ]},
    { id: "carers", label: "Carer's Allowance", questions: [
      "Am I eligible for Carer's Allowance?",
      "How many hours do I need to care to qualify?",
      "Can I work and claim Carer's Allowance?",
    ]},
    { id: "lpa", label: "Lasting power of attorney", questions: [
      "How do I set up a lasting power of attorney?",
      "What's the difference between health and financial LPA?",
      "How much does it cost to register an LPA?",
    ]},
  ],
  driving: [
    { id: "mot", label: "Vehicle maintenance & MOT", questions: [
      "When is my MOT due and what do I need to prepare?",
      "What happens if my MOT has expired?",
      "How do I find an MOT testing centre near me?",
    ]},
    { id: "tax", label: "Road tax & SORN", questions: [
      "How do I renew my road tax?",
      "Can I get a refund on my road tax?",
      "What is a SORN and when do I need one?",
    ]},
    { id: "licence", label: "Driving licence", questions: [
      "How do I renew my driving licence?",
      "How do I change the address on my licence?",
      "What documents do I need for a provisional licence?",
    ]},
    { id: "insurance", label: "Insurance", questions: [
      "What type of car insurance do I need?",
      "How do I check if a vehicle is insured?",
      "What happens if I drive without insurance?",
    ]},
  ],
  employment: [
    { id: "findjob", label: "Finding a job", questions: [
      "How do I use the Find a Job service?",
      "What help is available for job seekers?",
      "How do I write a CV for government jobs?",
    ]},
    { id: "rights", label: "Employment rights", questions: [
      "What are my rights regarding redundancy pay?",
      "How do I check I'm being paid the minimum wage?",
      "What are my rights to flexible working?",
    ]},
    { id: "sickpay", label: "Sick pay & leave", questions: [
      "How much Statutory Sick Pay will I get?",
      "How long can I claim sick pay for?",
      "What is my employer's duty for sick leave?",
    ]},
  ],
  health: [
    { id: "nhs", label: "NHS services", questions: [
      "How do I register with a GP?",
      "How do I find an NHS dentist near me?",
      "Am I eligible for free prescriptions?",
    ]},
    { id: "pip", label: "PIP & disability", questions: [
      "How do I apply for Personal Independence Payment?",
      "What evidence do I need for a PIP claim?",
      "How do I challenge a PIP decision?",
    ]},
    { id: "mental", label: "Mental health support", questions: [
      "How do I access NHS mental health services?",
      "What is an IAPT self-referral?",
      "Can I get time off work for mental health?",
    ]},
  ],
  money: [
    { id: "incometax", label: "Income Tax & PAYE", questions: [
      "How do I check my tax code is correct?",
      "How do I claim a tax refund?",
      "What is my personal allowance?",
    ]},
    { id: "selfassess", label: "Self-assessment", questions: [
      "When is the self-assessment deadline?",
      "How do I register for self-assessment?",
      "What expenses can I deduct on my tax return?",
    ]},
    { id: "ni", label: "National Insurance", questions: [
      "How do I check my National Insurance record?",
      "Can I pay voluntary NI contributions?",
      "What NI class do I pay as self-employed?",
    ]},
  ],
  parenting: [
    { id: "maternity", label: "Maternity & paternity", questions: [
      "What maternity pay am I entitled to?",
      "How do I claim Statutory Maternity Pay?",
      "When should I tell my employer I'm pregnant?",
    ]},
    { id: "childben", label: "Child Benefit", questions: [
      "How do I claim Child Benefit?",
      "Do I need to pay back Child Benefit?",
      "When does Child Benefit stop?",
    ]},
    { id: "birth", label: "Registering a birth", questions: [
      "How do I register my baby's birth?",
      "What documents do I need for birth registration?",
      "How long do I have to register a birth?",
    ]},
    { id: "schools", label: "Schools & childcare", questions: [
      "How do I apply for a school place?",
      "Am I eligible for free childcare?",
      "What's the Tax-Free Childcare scheme?",
    ]},
  ],
  retirement: [
    { id: "statepension", label: "State Pension", questions: [
      "When can I claim my State Pension?",
      "How much State Pension will I get?",
      "Can I defer my State Pension?",
    ]},
    { id: "pensioncredit", label: "Pension Credit", questions: [
      "Am I eligible for Pension Credit?",
      "How do I apply for Pension Credit?",
      "Can I get Pension Credit if I have savings?",
    ]},
    { id: "workplace", label: "Workplace pensions", questions: [
      "How do I find a lost pension?",
      "What is auto-enrolment for pensions?",
      "Can I take my pension early?",
    ]},
  ],
  studying: [
    { id: "studentfin", label: "Student loans & finance", questions: [
      "How do I apply for a student loan?",
      "When do I start repaying my student loan?",
      "Am I eligible for a maintenance grant?",
    ]},
    { id: "apprentice", label: "Apprenticeships", questions: [
      "How do I find an apprenticeship?",
      "What is the apprenticeship minimum wage?",
      "Can adults apply for apprenticeships?",
    ]},
    { id: "adulted", label: "Adult education", questions: [
      "What free courses are available for adults?",
      "How do I access the National Careers Service?",
      "Am I eligible for an Advanced Learner Loan?",
    ]},
  ],
  travel: [
    { id: "passport", label: "Passports", questions: [
      "How do I renew my passport?",
      "How long does a passport application take?",
      "What documents do I need for a first passport?",
    ]},
    { id: "abroad", label: "Travel abroad", questions: [
      "What is the latest travel advice for my destination?",
      "How do I get a GHIC or EHIC card?",
      "Do I need travel insurance?",
    ]},
    { id: "eta", label: "Visas & immigration", questions: [
      "Do I need a visa to visit the UK?",
      "What is an Electronic Travel Authorisation?",
      "How do I extend my UK visa?",
    ]},
  ],
};

interface TopicListProps {
  service: string;
}

export function TopicList({ service }: TopicListProps) {
  const openBottomSheet = useAppStore((s) => s.openBottomSheet);
  const topics = SERVICE_TOPICS[service] || [];

  if (topics.length === 0) return null;

  return (
    <div className="mb-5">
      <h3 className="text-base font-extrabold text-govuk-black mb-3">Topics</h3>
      <div className="bg-white rounded-card shadow-sm divide-y divide-gray-100">
        {topics.map((topic) => (
          <button
            key={topic.id}
            onClick={() => openBottomSheet("topic-questions", {
              topic: topic.label,
              questions: topic.questions,
              service,
            })}
            className="flex items-center gap-3 w-full p-3.5 text-left hover:bg-gray-50 transition-colors touch-feedback first:rounded-t-card last:rounded-b-card"
          >
            <span className="flex-1 text-sm font-medium text-govuk-black">{topic.label}</span>
            <svg className="shrink-0 text-govuk-mid-grey" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
