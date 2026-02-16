"use client";

interface FormFieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export default function FormField({ label, hint, error, required, children }: FormFieldProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-bold mb-1">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-govuk-dark-grey mb-1">{hint}</p>}
      <div className={error ? "border-l-4 border-red-600 pl-2" : ""}>
        {children}
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
