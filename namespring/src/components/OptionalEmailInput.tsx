interface OptionalEmailInputProps {
  value: string;
  onChange: (nextValue: string) => void;
  disabled?: boolean;
  errorMessage?: string;
}

export default function OptionalEmailInput({
  value,
  onChange,
  disabled = false,
  errorMessage,
}: OptionalEmailInputProps) {
  return (
    <div className="space-y-2">
      <label htmlFor="support-email" className="block text-sm font-bold text-[var(--color-accent)]">
        Email (optional)
      </label>
      <input
        id="support-email"
        type="email"
        inputMode="email"
        placeholder="you@example.com"
        className={[
          "ns-input",
          errorMessage ? "border-red-500" : "border-[var(--ns-border)]",
          disabled ? "opacity-60 cursor-not-allowed" : "",
        ].join(" ")}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        autoComplete="email"
      />
      {errorMessage ? <p className="text-xs font-semibold text-[var(--color-danger)]">{errorMessage}</p> : null}
    </div>
  );
}
