import React, { useEffect, useState } from 'react';

function InputForm({ hanjaRepo, isDbReady, onAnalyze }) {
  const [lastNameHangul, setLastNameHangul] = useState('');
  const [firstNameHangul, setFirstNameHangul] = useState('');
  const [birthDate, setBirthDate] = useState('2026-01-01');
  const [birthTime, setBirthTime] = useState('12:00');
  const [gender, setGender] = useState('female');

  const [selectedSurnameEntries, setSelectedSurnameEntries] = useState([]);
  const [selectedFirstNameEntries, setSelectedFirstNameEntries] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState({ type: 'last', index: 0, char: '' });
  const [hanjaOptions, setHanjaOptions] = useState([]);

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
    const hasName = lastNameHangul.length > 0 && firstNameHangul.length > 0;
    const isComplete = hasName && !selectedSurnameEntries.includes(null) && !selectedFirstNameEntries.includes(null);
    if (!isComplete) {
      alert('모든 한자를 선택해주세요.');
      return;
    }

    const [year, month, day] = birthDate.split('-').map(Number);
    const [hour, minute] = birthTime.split(':').map(Number);

    onAnalyze({
      lastName: selectedSurnameEntries,
      firstName: selectedFirstNameEntries,
      birthDateTime: { year, month, day, hour, minute },
      gender,
    });
  };

  return (
    <>
      <div className="space-y-8 animate-in fade-in duration-500">
        <section className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Birth Date</label>
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold" />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Birth Time</label>
            <input type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold" />
          </div>
        </section>

        <section>
          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Gender</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setGender('female')}
              className={`py-3 rounded-2xl font-black text-sm border ${gender === 'female' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
            >
              Female
            </button>
            <button
              type="button"
              onClick={() => setGender('male')}
              className={`py-3 rounded-2xl font-black text-sm border ${gender === 'male' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
            >
              Male
            </button>
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block">Surname (Family Name)</label>
            <div className="flex gap-4">
              <input type="text" value={lastNameHangul} onChange={(e) => setLastNameHangul(e.target.value)} className="w-20 p-4 bg-slate-50 border-none rounded-2xl text-2xl font-black text-center" maxLength={2} placeholder="성" />
              <div className="flex-1 flex gap-2">
                {lastNameHangul.split('').map((char, i) => (
                  <button key={i} onClick={() => searchHanja(char, 'last', i)} className="flex-1 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center hover:border-indigo-400 bg-white">
                    {selectedSurnameEntries[i] ? <span className="text-2xl font-serif font-black">{selectedSurnameEntries[i].hanja}</span> : <span className="text-[9px] font-black text-slate-300">한자선택</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block">Given Name (First Name)</label>
            <input type="text" value={firstNameHangul} onChange={(e) => setFirstNameHangul(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl text-2xl font-black text-center mb-4 tracking-widest" maxLength={4} placeholder="이름" />
            <div className="grid grid-cols-3 gap-3">
              {firstNameHangul.split('').map((char, i) => (
                <button key={i} onClick={() => searchHanja(char, 'first', i)} className="h-20 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center hover:border-indigo-400 bg-white">
                  {selectedFirstNameEntries[i] ? <span className="text-3xl font-serif font-black">{selectedFirstNameEntries[i].hanja}</span> : <span className="text-[9px] font-black text-slate-300">한자선택</span>}
                </button>
              ))}
            </div>
          </div>
        </section>

        <button
          onClick={handleAnalyze}
          disabled={!isDbReady}
          className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-lg hover:bg-black transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          ANALYZE NAME
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
              <h3 className="font-black text-slate-800 tracking-tight">'{modalTarget.char}' 한자 선택</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-indigo-600 text-2xl font-bold">&times;</button>
            </div>
            <div className="p-4 max-h-[50vh] overflow-y-auto space-y-2">
              {hanjaOptions.map((item, idx) => (
                <button key={idx} onClick={() => handleSelectHanja(item)} className="w-full flex items-center justify-between p-4 hover:bg-indigo-600 rounded-2xl transition-all group border border-transparent hover:text-white">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl font-serif font-black">{item.hanja}</span>
                    <div className="text-left">
                      <p className="text-sm font-black">{item.meaning}</p>
                      <p className="text-[9px] opacity-60 font-bold uppercase">{item.strokes} STROKES · {item.resource_element}</p>
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
