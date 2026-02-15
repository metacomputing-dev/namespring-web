import React, { useEffect, useMemo, useState } from 'react';

function limitLength(value, max) {
  return Array.from(value).slice(0, max).join('');
}

function extractCompletedHangul(value) {
  return Array.from(value).filter((char) => /[가-힣]/.test(char)).join('');
}

function validateSurname(value) {
  return /^[가-힣]{1,2}$/.test(value);
}

function validateGivenName(value) {
  return /^[가-힣]{1,4}$/.test(value);
}

function formatDateForDisplay(isoDate) {
  if (!isoDate) return 'YYYY.MM.DD';
  return isoDate.replace(/-/g, '.');
}

function InputForm({ hanjaRepo, isDbReady, onAnalyze, onEnter, submitLabel = '시작하기' }) {
  const [surnameInput, setSurnameInput] = useState('');
  const [givenNameInput, setGivenNameInput] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');

  const [selectedSurnameEntries, setSelectedSurnameEntries] = useState([]);
  const [selectedGivenNameEntries, setSelectedGivenNameEntries] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalTarget, setModalTarget] = useState({ type: 'last', index: 0, char: '' });
  const [hanjaOptions, setHanjaOptions] = useState([]);
  const [hanjaSearchKeyword, setHanjaSearchKeyword] = useState('');

  const surnameHangul = extractCompletedHangul(surnameInput);
  const givenNameHangul = extractCompletedHangul(givenNameInput);

  const isSurnameValid = validateSurname(surnameHangul);
  const isGivenNameValid = validateGivenName(givenNameHangul);
  const isNameTextValid = isSurnameValid && isGivenNameValid;
  const isBirthDateValid = /^\d{4}-\d{2}-\d{2}$/.test(birthDate);
  const isGenderDone = gender !== '';

  useEffect(() => {
    setSelectedSurnameEntries((prev) => new Array(surnameHangul.length).fill(null).map((_, i) => prev[i] || null));
  }, [surnameHangul]);

  useEffect(() => {
    setSelectedGivenNameEntries((prev) => new Array(givenNameHangul.length).fill(null).map((_, i) => prev[i] || null));
  }, [givenNameHangul]);

  const isNameSelectionDone =
    isNameTextValid &&
    selectedSurnameEntries.length === surnameHangul.length &&
    selectedGivenNameEntries.length === givenNameHangul.length &&
    !selectedSurnameEntries.includes(null) &&
    !selectedGivenNameEntries.includes(null);

  const filteredHanjaOptions = useMemo(() => {
    const keyword = hanjaSearchKeyword.trim();
    if (!keyword) return hanjaOptions;
    return hanjaOptions.filter((item) => {
      const source = `${item.hangul ?? ''} ${item.meaning ?? ''}`;
      return source.includes(keyword);
    });
  }, [hanjaOptions, hanjaSearchKeyword]);

  const openModal = () => {
    setIsModalOpen(true);
    window.setTimeout(() => setIsModalVisible(true), 10);
  };

  const closeModal = () => {
    setIsModalVisible(false);
    window.setTimeout(() => setIsModalOpen(false), 220);
  };

  const searchHanja = async (char, type, index) => {
    if (!isDbReady) return;
    const results = type === 'last'
      ? await hanjaRepo.findSurnamesByHangul(char)
      : await hanjaRepo.findByHangul(char);

    setHanjaOptions(results);
    setHanjaSearchKeyword('');
    setModalTarget({ type, index, char });
    openModal();
  };

  const handleSelectHanja = (entry) => {
    if (modalTarget.type === 'last') {
      const next = [...selectedSurnameEntries];
      next[modalTarget.index] = entry;
      setSelectedSurnameEntries(next);
    } else {
      const next = [...selectedGivenNameEntries];
      next[modalTarget.index] = entry;
      setSelectedGivenNameEntries(next);
    }
    closeModal();
  };

  const handleSubmit = () => {
    if (!isBirthDateValid || !isNameSelectionDone || !isGenderDone) {
      alert('모든 입력을 순서대로 완료해 주세요.');
      return;
    }

    const [year, month, day] = birthDate.split('-').map(Number);
    const payload = {
      lastName: selectedSurnameEntries,
      firstName: selectedGivenNameEntries,
      birthDateTime: { year, month, day, hour: 12, minute: 0 },
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="text-[11px] font-black text-[var(--ns-muted)] mb-2 block">성</label>
              <input
                type="text"
                value={surnameInput}
                onChange={(e) => setSurnameInput(limitLength(e.target.value.replace(/\s/g, ''), 2))}
                className="w-full p-4 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-2xl text-2xl font-black text-center text-[var(--ns-text)]"
                maxLength={2}
                placeholder="성"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[11px] font-black text-[var(--ns-muted)] mb-2 block">이름</label>
              <input
                type="text"
                value={givenNameInput}
                onChange={(e) => setGivenNameInput(limitLength(e.target.value.replace(/\s/g, ''), 4))}
                className="w-full p-4 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-2xl text-2xl font-black text-center tracking-widest text-[var(--ns-text)]"
                maxLength={4}
                placeholder="이름"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {surnameHangul.length >= 1 && isSurnameValid && (
              <div className="animate-in fade-in duration-200 md:col-span-1">
                <p className="text-[11px] font-black text-[var(--ns-muted)] mb-2">성 한자 고르기</p>
                <div className="flex gap-2 min-h-[84px]">
                  {surnameHangul.split('').map((char, i) => (
                    <button
                      key={`${char}-${i}`}
                      onClick={() => searchHanja(char, 'last', i)}
                      className="flex-1 border-2 border-dashed border-[var(--ns-border)] rounded-2xl flex flex-col items-center justify-center hover:border-[var(--ns-primary)] bg-[var(--ns-surface)]"
                    >
                      {selectedSurnameEntries[i]
                        ? <span className="text-2xl font-serif font-black text-[var(--ns-text)]">{selectedSurnameEntries[i].hanja}</span>
                        : <span className="text-[10px] font-black text-[var(--ns-muted)]">한자 고르기</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {givenNameHangul.length >= 1 && isGivenNameValid && (
              <div className="animate-in fade-in duration-200 md:col-span-2">
                <p className="text-[11px] font-black text-[var(--ns-muted)] mb-2">이름 한자 고르기</p>
                <div className="grid grid-cols-2 gap-2 min-h-[84px]">
                  {givenNameHangul.split('').map((char, i) => (
                    <button
                      key={`${char}-${i}`}
                      onClick={() => searchHanja(char, 'first', i)}
                      className="h-20 border-2 border-dashed border-[var(--ns-border)] rounded-2xl flex items-center justify-center hover:border-[var(--ns-primary)] bg-[var(--ns-surface)]"
                    >
                      {selectedGivenNameEntries[i]
                        ? <span className="text-3xl font-serif font-black text-[var(--ns-text)]">{selectedGivenNameEntries[i].hanja}</span>
                        : <span className="text-[10px] font-black text-[var(--ns-muted)]">한자 고르기</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {isNameSelectionDone && (
          <section className="space-y-4 bg-[var(--ns-surface-soft)] border border-[var(--ns-border)] rounded-3xl p-6 animate-in fade-in duration-300">
            <h3 className="text-base font-black text-[var(--ns-accent-text)]">{`${surnameHangul}${givenNameHangul}`}님이 언제 태어났는지 알고싶어요.</h3>
            <label className="text-[11px] font-black text-[var(--ns-muted)] block">생년월일</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full p-4 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-2xl font-bold text-[var(--ns-text)]"
            />
            <p className="text-[11px] font-semibold text-[var(--ns-muted)]">{formatDateForDisplay(birthDate)}</p>
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
            onClick={handleSubmit}
            disabled={!isDbReady}
            className="w-full py-6 bg-[var(--ns-primary)] text-[var(--ns-accent-text)] rounded-[2rem] font-black text-lg hover:brightness-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed animate-in fade-in duration-300"
          >
            {submitLabel}
          </button>
        )}
      </div>

      {isModalOpen && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-colors duration-200 ${isModalVisible ? 'bg-black/35' : 'bg-black/0'}`}>
          <div className={`bg-[var(--ns-surface)] rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-[var(--ns-border)] transition-all duration-200 ${isModalVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
            <div className="p-6 bg-[var(--ns-surface-soft)] border-b border-[var(--ns-border)] flex justify-between items-center">
              <h3 className="font-black text-[var(--ns-text)] tracking-tight">'{modalTarget.char}' 한자 고르기</h3>
              <button onClick={closeModal} className="text-[var(--ns-muted)] hover:text-[var(--ns-primary)] text-2xl font-bold">&times;</button>
            </div>

            <div className="px-4 pt-4">
              <input
                type="text"
                value={hanjaSearchKeyword}
                onChange={(e) => setHanjaSearchKeyword(e.target.value)}
                placeholder="한글로 뜻 검색"
                className="w-full p-3 bg-[var(--ns-surface-soft)] border border-[var(--ns-border)] rounded-xl text-sm font-semibold text-[var(--ns-text)]"
              />
            </div>

            <div className="p-4 max-h-[50vh] overflow-y-auto space-y-2">
              {filteredHanjaOptions.length === 0 && (
                <div className="p-6 text-center text-sm font-semibold text-[var(--ns-muted)]">
                  검색 결과가 없습니다.
                </div>
              )}
              {filteredHanjaOptions.map((item, idx) => (
                <button key={idx} onClick={() => handleSelectHanja(item)} className="w-full flex items-center justify-between p-4 hover:bg-[var(--ns-primary)] rounded-2xl transition-all group border border-transparent hover:text-[var(--ns-accent-text)]">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl font-serif font-black text-[var(--ns-text)] group-hover:text-[var(--ns-accent-text)]">{item.hanja}</span>
                    <div className="text-left">
                      <p className="text-sm font-black text-[var(--ns-text)] group-hover:text-[var(--ns-accent-text)]">{item.meaning}</p>
                      <p className="text-[10px] opacity-70 font-bold">{item.strokes}획 · {item.hangul}</p>
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
