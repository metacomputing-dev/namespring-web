import type { HanjaOption } from "../types";

interface HanjaSelectionModalProps {
  isOpen: boolean;
  targetChar: string;
  options: HanjaOption[];
  onClose: () => void;
  onSelect: (entry: HanjaOption) => void;
}

function getResourceLabel(option: HanjaOption): string {
  return option.resourceElement ?? option.resource_element ?? "-";
}

function getStrokeLabel(option: HanjaOption): number {
  return option.strokes || option.strokeCount || 0;
}

export default function HanjaSelectionModal({
  isOpen,
  targetChar,
  options,
  onClose,
  onSelect,
}: HanjaSelectionModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 bg-orange-50 px-6 py-4">
          <h3 className="text-lg font-black text-slate-900">Pick Hanja for '{targetChar}'</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm font-bold text-slate-500 transition hover:bg-white hover:text-slate-900"
            aria-label="Close Hanja picker"
          >
            Close
          </button>
        </header>

        <div className="max-h-[60vh] space-y-2 overflow-y-auto p-4">
          {options.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No Hanja candidate found for this character.
            </div>
          )}

          {options.map((option, index) => (
            <button
              key={`${option.hanja}-${index}`}
              type="button"
              onClick={() => onSelect(option)}
              className="group flex w-full items-center justify-between rounded-2xl border border-slate-100 px-4 py-3 text-left transition hover:border-orange-300 hover:bg-orange-50"
            >
              <div className="flex items-center gap-4">
                <span className="text-4xl font-black text-slate-900">{option.hanja}</span>
                <div>
                  <div className="text-sm font-bold text-slate-800">{option.meaning || "No meaning data"}</div>
                  <div className="text-xs text-slate-500">
                    {getStrokeLabel(option)} strokes - resource element {getResourceLabel(option)}
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500 opacity-0 transition group-hover:opacity-100">
                Select
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
