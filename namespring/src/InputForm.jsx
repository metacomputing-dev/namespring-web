import React, { useEffect, useState } from 'react';

function InputForm({ hanjaRepo, isDbReady, onAnalyze, onEnter, submitLabel = '입장하기' }) {
  const [lastNameHangul, setLastNameHangul] = useState('');
  const [firstNameHangul, setFirstNameHangul] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');

  const [selectedSurnameEntries, setSelectedSurnameEntries] = useState([]);
  const [selectedFirstNameEntries, setSelectedFirstNameEntries] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState({ type: 'last', index: 0, char: '' });
  const [hanjaOptions, setHanjaOptions] = useState([]);

  const isBirthDateValid = /^\d{4}-\d{2}-\d{2}$/.test(birthDate);
  const isNameTextValid =
    lastNameHangul.length > 0 &&
    firstNameHangul.length > 0 &&
    /^[가-힣]+$/.test(lastNameHangul) &&
    /^[가-힣]+$/.test(firstNameHangul);
  const isNameSelectionDone =
    isNameTextValid &&
    selectedSurnameEntries.length === lastNameHangul.length &&
    selectedFirstNameEntries.length === firstNameHangul.length &&
    !selectedSurnameEntries.includes(null) &&
    !selectedFirstNameEntries.includes(null);
  const isGenderDone = gender !== '';

  useEffect(() => {
    setSelectedSurnameEntries((prev) => new Array(lastNameHangul.length).fill(null).map((_, i) => prev[i] || null));
  }, [lastNameHangul]);

  useEffect(() => {
    setSelectedFirstNameEntries((prev) => new Array(firstNameHangul.length).fill(null).map((_, i) => prev[i] || null));
  }, [firstNameHangul]);

  const searchHanja = async (char, type, index) => {
    if (!isDbReady) return;
    const results = type === 'last'
      ? await hanjaRepo.findSurnamesByHangul(char)
      : await hanjaRepo.findByHangul(char);

    setHanjaOptions(results);
    setModalTarget({ type, index, char });
    setIsModalOpen(true);
  };

  const handleSelectHanja = (entry) => {
    if (modalTarget.type === 'last') {
      const newArr = [...selectedSurnameEntries];
      newArr[modalTarget.index] = entry;
      setSelectedSurnameEntries(newArr);
    } else {
      const newArr = [...selectedFirstNameEntries];
      newArr[modalTarget.index] = entry;
      setSelectedFirstNameEntries(newArr);
    }
    setIsModalOpen(false);
  };

  const handleAnalyze = () => {
    const isComplete = isBirthDateValid && isNameSelectionDone && isGenderDone;
    if (!isComplete) {
      alert('모든 입력을 순서대로 완료해 주세요.');
      return;
    }

    const [year, month, day] = birthDate.split('-').map(Number);
    const hour = 12;
    const minute = 0;

    const payload = {
      lastName: selectedSurnameEntries,
      firstName: selectedFirstNameEntries,
      birthDateTime: { year, month, day, hour, minute },
      gender,
    };

    if (onEnter) {
      onEnter(payload);
      return;
    }
    if (onAnalyze) {
      onAnalyze(payload);
    }
  };

  return (
    <>
      <div className="space-y-8 animate-in fade-in duration-500">
        <section className="space-y-6 bg-[var(--ns-surface-soft)] border border-[var(--ns-border)] rounded-3xl p-6">
          <h3 className="text-base font-black text-[var(--ns-accent-text)]">당신의 이름을 알려주세요.</h3>
          <div>
            <label className="text-[11px] font-black text-[var(--ns-muted)] mb-3 block">성</label>
            <div className="flex gap-4">
              <input
                type="text"
                value={lastNameHangul}
                onChange={(e) => setLastNameHangul(e.target.value.replace(/[^가-힣]/g, '').slice(0, 2))}
                className="w-20 p-4 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-2xl text-2xl font-black text-center text-[var(--ns-text)]"
                maxLength={2}
                placeholder="성"
              />
              <div className="flex-1 flex gap-2">
                {lastNameHangul.split('').map((char, i) => (
                  <button key={i} onClick={() => searchHanja(char, 'last', i)} className="flex-1 border-2 border-dashed border-[var(--ns-border)] rounded-2xl flex flex-col items-center justify-center hover:border-[var(--ns-primary)] bg-[var(--ns-surface)]">
                    {selectedSurnameEntries[i] ? <span className="text-2xl font-serif font-black text-[var(--ns-text)]">{selectedSurnameEntries[i].hanja}</span> : <span className="text-[10px] font-black text-[var(--ns-muted)]">한자 고르기</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-black text-[var(--ns-muted)] mb-3 block">이름</label>
            <input
              type="text"
              value={firstNameHangul}
              onChange={(e) => setFirstNameHangul(e.target.value.replace(/[^가-힣]/g, '').slice(0, 4))}
              className="w-full p-4 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-2xl text-2xl font-black text-center mb-4 tracking-widest text-[var(--ns-text)]"
              maxLength={4}
              placeholder="이름"
            />
            <div className="grid grid-cols-3 gap-3">
              {firstNameHangul.split('').map((char, i) => (
                <button key={i} onClick={() => searchHanja(char, 'first', i)} className="h-20 border-2 border-dashed border-[var(--ns-border)] rounded-2xl flex items-center justify-center hover:border-[var(--ns-primary)] bg-[var(--ns-surface)]">
                  {selectedFirstNameEntries[i] ? <span className="text-3xl font-serif font-black text-[var(--ns-text)]">{selectedFirstNameEntries[i].hanja}</span> : <span className="text-[10px] font-black text-[var(--ns-muted)]">한자 고르기</span>}
                </button>
              ))}
            </div>
          </div>
        </section>

        {isNameSelectionDone && (
          <section className="space-y-6 bg-[var(--ns-surface-soft)] border border-[var(--ns-border)] rounded-3xl p-6 animate-in fade-in duration-300">
            <h3 className="text-base font-black text-[var(--ns-accent-text)]">{`${lastNameHangul}${firstNameHangul}`}님이 언제 태어났는지 알고싶어요.</h3>
            <label className="text-[11px] font-black text-[var(--ns-muted)] block">생년월일</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full p-4 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-2xl font-bold text-[var(--ns-text)]"
            />
            {!isBirthDateValid && birthDate.length > 0 && (
              <p className="text-[11px] font-semibold text-[var(--ns-muted)]">올바른 날짜를 선택해 주세요.</p>
            )}
          </section>
        )}

        {isBirthDateValid && (
          <section className="bg-[var(--ns-surface-soft)] border border-[var(--ns-border)] rounded-3xl p-6 animate-in fade-in duration-300">
            <h3 className="text-base font-black text-[var(--ns-accent-text)] mb-3">성별은요?</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGender('female')}
                className={`py-3 rounded-2xl font-black text-sm border ${gender === 'female' ? 'bg-[var(--ns-primary)] text-[var(--ns-accent-text)] border-[var(--ns-primary)]' : 'bg-[var(--ns-surface)] text-[var(--ns-muted)] border-[var(--ns-border)]'}`}
              >
                여성
              </button>
              <button
                type="button"
                onClick={() => setGender('male')}
                className={`py-3 rounded-2xl font-black text-sm border ${gender === 'male' ? 'bg-[var(--ns-primary)] text-[var(--ns-accent-text)] border-[var(--ns-primary)]' : 'bg-[var(--ns-surface)] text-[var(--ns-muted)] border-[var(--ns-border)]'}`}
              >
                남성
              </button>
            </div>
          </section>
        )}

        {isGenderDone && (
          <button
            onClick={handleAnalyze}
            disabled={!isDbReady}
            className="w-full py-6 bg-[var(--ns-primary)] text-[var(--ns-accent-text)] rounded-[2rem] font-black text-lg hover:brightness-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed animate-in fade-in duration-300"
          >
            {submitLabel}
          </button>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--ns-surface)] rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-[var(--ns-border)]">
            <div className="p-6 bg-[var(--ns-surface-soft)] border-b border-[var(--ns-border)] flex justify-between items-center">
              <h3 className="font-black text-[var(--ns-text)] tracking-tight">'{modalTarget.char}' 한자 고르기</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--ns-muted)] hover:text-[var(--ns-primary)] text-2xl font-bold">&times;</button>
            </div>
            <div className="p-4 max-h-[50vh] overflow-y-auto space-y-2">
              {hanjaOptions.map((item, idx) => (
                <button key={idx} onClick={() => handleSelectHanja(item)} className="w-full flex items-center justify-between p-4 hover:bg-[var(--ns-primary)] rounded-2xl transition-all group border border-transparent hover:text-[var(--ns-accent-text)]">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl font-serif font-black text-[var(--ns-text)] group-hover:text-[var(--ns-accent-text)]">{item.hanja}</span>
                    <div className="text-left">
                      <p className="text-sm font-black text-[var(--ns-text)] group-hover:text-[var(--ns-accent-text)]">{item.meaning}</p>
                      <p className="text-[10px] opacity-70 font-bold">{item.strokes}획</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default InputForm;
