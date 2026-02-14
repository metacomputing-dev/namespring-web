const VARIANT_STYLES = {
  surname: {
    container: 'flex gap-4',
    input: 'w-20 p-4 bg-slate-50 border-none rounded-2xl text-2xl font-black text-center',
    options: 'flex-1 flex gap-2',
    optionButton:
      'flex-1 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center hover:border-indigo-400 bg-white disabled:opacity-40 disabled:cursor-not-allowed',
    selectedText: 'text-2xl font-serif font-black',
    emptyText: 'text-[9px] font-black text-slate-300',
  },
  given: {
    container: 'space-y-4',
    input:
      'w-full p-4 bg-slate-50 border-none rounded-2xl text-2xl font-black text-center tracking-widest',
    options: 'grid grid-cols-3 gap-3',
    optionButton:
      'h-20 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center hover:border-indigo-400 bg-white disabled:opacity-40 disabled:cursor-not-allowed',
    selectedText: 'text-3xl font-serif font-black',
    emptyText: 'text-[9px] font-black text-slate-300',
  },
};

function NameInputSection({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  selectedEntries,
  onSelectCharacter,
  targetType,
  variant = 'given',
}) {
  const styles = VARIANT_STYLES[variant] ?? VARIANT_STYLES.given;
  const characters = Array.from(value ?? '');

  return (
    <div>
      <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block">{label}</label>
      <div className={styles.container}>
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={styles.input}
          maxLength={maxLength}
          placeholder={placeholder}
        />
        <div className={styles.options}>
          {characters.map((char, index) => (
            <button
              key={`${targetType}-${index}-${char}`}
              type="button"
              onClick={() => onSelectCharacter(char, targetType, index)}
              className={styles.optionButton}
              disabled={!char}
            >
              {selectedEntries[index] ? (
                <span className={styles.selectedText}>{selectedEntries[index].hanja}</span>
              ) : (
                <span className={styles.emptyText}>한자 선택</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default NameInputSection;

