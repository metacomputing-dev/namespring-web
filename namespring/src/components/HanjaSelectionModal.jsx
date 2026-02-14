function HanjaSelectionModal({ isOpen, targetChar, options = [], onClose, onSelect }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
          <h3 className="font-black text-slate-800 tracking-tight">'{targetChar}' 한자 선택</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-indigo-600 text-2xl font-bold"
            aria-label="한자 선택 모달 닫기"
          >
            &times;
          </button>
        </div>
        <div className="p-4 max-h-[50vh] overflow-y-auto space-y-2">
          {options.length === 0 && (
            <p className="text-sm font-semibold text-slate-400 text-center py-6">선택 가능한 한자가 없습니다.</p>
          )}
          {options.map((item, index) => (
            <button
              key={`${item.hanja}-${index}`}
              type="button"
              onClick={() => onSelect(item)}
              className="w-full flex items-center justify-between p-4 hover:bg-indigo-600 rounded-2xl transition-all group border border-transparent hover:text-white"
            >
              <div className="flex items-center gap-4">
                <span className="text-4xl font-serif font-black">{item.hanja}</span>
                <div className="text-left">
                  <p className="text-sm font-black">{item.meaning || '의미 정보 없음'}</p>
                  <p className="text-[9px] opacity-60 font-bold uppercase">
                    {(item.strokes ?? item.strokeCount) || '-'} STROKES | {item.resource_element || '-'}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default HanjaSelectionModal;

