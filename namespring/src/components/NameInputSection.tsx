import type { HanjaOption, NameTargetType } from "../types";

const VARIANT_STYLES = {
  surname: {
    container: "grid gap-3 md:grid-cols-[120px_1fr]",
    input:
      "w-full rounded-2xl border border-orange-200 bg-orange-50 px-4 py-4 text-center text-2xl font-extrabold tracking-wide outline-none transition focus:border-orange-500 focus:bg-white",
    options: "grid gap-2 sm:grid-cols-2",
    optionButton:
      "rounded-2xl border-2 border-dashed border-orange-200 bg-white px-4 py-3 text-left transition hover:border-orange-400 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50",
  },
  given: {
    container: "grid gap-3",
    input:
      "w-full rounded-2xl border border-teal-200 bg-teal-50 px-4 py-4 text-center text-2xl font-extrabold tracking-[0.25em] outline-none transition focus:border-teal-500 focus:bg-white",
    options: "grid gap-2 sm:grid-cols-2",
    optionButton:
      "rounded-2xl border-2 border-dashed border-teal-200 bg-white px-4 py-3 text-left transition hover:border-teal-400 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50",
  },
} as const;

interface NameInputSectionProps {
  label: string;
  value: string;
  maxLength: number;
  placeholder: string;
  selectedEntries: Array<HanjaOption | null>;
  targetType: NameTargetType;
  onChange: (value: string) => void;
  onSelectCharacter: (char: string, type: NameTargetType, index: number) => void;
  selectionEnabled: boolean;
  variant?: keyof typeof VARIANT_STYLES;
}

export default function NameInputSection({
  label,
  value,
  maxLength,
  placeholder,
  selectedEntries,
  targetType,
  onChange,
  onSelectCharacter,
  selectionEnabled,
  variant = "given",
}: NameInputSectionProps) {
  const styles = VARIANT_STYLES[variant] ?? VARIANT_STYLES.given;
  const characters = Array.from(value);

  return (
    <section className="space-y-2">
      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{label}</label>
      <div className={styles.container}>
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          placeholder={placeholder}
          className={styles.input}
        />

        <div className={styles.options}>
          {characters.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Enter Hangul first, then pick Hanja for each character.
            </div>
          )}

          {characters.map((char, index) => {
            const selected = selectedEntries[index];
            const meaning = selected?.meaning ?? "Select Hanja";
            return (
              <button
                key={`${targetType}-${char}-${index}`}
                type="button"
                onClick={() => onSelectCharacter(char, targetType, index)}
                className={styles.optionButton}
                disabled={!char || !selectionEnabled}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{char}</div>
                <div className="mt-1 text-3xl font-black leading-none text-slate-900">
                  {selected?.hanja ?? "?"}
                </div>
                <div className="mt-2 text-xs text-slate-500">{meaning}</div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
