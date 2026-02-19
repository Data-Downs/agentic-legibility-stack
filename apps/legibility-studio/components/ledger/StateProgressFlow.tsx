"use client";

interface StateDefinition {
  id: string;
  type?: string;
}

export default function StateProgressFlow({
  states,
  currentState,
  statesCompleted,
}: {
  states: StateDefinition[];
  currentState: string;
  statesCompleted: string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {states.map((state, i) => {
        const isCompleted = statesCompleted.includes(state.id);
        const isCurrent = state.id === currentState;

        let bgColor = "bg-gray-200 text-gray-500";
        if (isCompleted && !isCurrent) bgColor = "bg-green-100 text-green-800 border-green-300";
        if (isCurrent) bgColor = "bg-govuk-blue text-white";

        return (
          <div key={state.id} className="flex items-center gap-1">
            <div
              className={`text-xs font-mono px-2 py-1 rounded border ${bgColor}`}
              title={state.id}
            >
              {state.id}
            </div>
            {i < states.length - 1 && (
              <span className="text-gray-300 text-xs">&rarr;</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
