import { useCallback, useEffect, useMemo, useState } from 'react';
import { SeedTs } from '@seed/seed';
import { HanjaRepository } from '@seed/database/hanja-repository';

const EMPTY_MODAL_TARGET = Object.freeze({ type: 'last', index: 0, char: '' });

const resizeSelectionEntries = (previousEntries, nextLength) =>
  new Array(nextLength).fill(null).map((_, index) => previousEntries[index] || null);

const hasAllEntriesSelected = (entries) => entries.length > 0 && entries.every((entry) => entry !== null);

export function useNameAnalysisForm() {
  const [isDbReady, setIsDbReady] = useState(false);
  const hanjaRepo = useMemo(() => new HanjaRepository(), []);
  const analyzer = useMemo(() => new SeedTs(), []);

  const [lastNameHangul, setLastNameHangul] = useState('');
  const [firstNameHangul, setFirstNameHangul] = useState('');
  const [birthDate, setBirthDate] = useState('2026-01-01');
  const [birthTime, setBirthTime] = useState('12:00');

  const [selectedSurnameEntries, setSelectedSurnameEntries] = useState([]);
  const [selectedFirstNameEntries, setSelectedFirstNameEntries] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState(EMPTY_MODAL_TARGET);
  const [hanjaOptions, setHanjaOptions] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        await hanjaRepo.init();
        if (isMounted) {
          setIsDbReady(true);
        }
      } catch (error) {
        console.error('Failed to initialize hanja repository.', error);
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [hanjaRepo]);

  useEffect(() => {
    setSelectedSurnameEntries((previousEntries) =>
      resizeSelectionEntries(previousEntries, lastNameHangul.length),
    );
  }, [lastNameHangul]);

  useEffect(() => {
    setSelectedFirstNameEntries((previousEntries) =>
      resizeSelectionEntries(previousEntries, firstNameHangul.length),
    );
  }, [firstNameHangul]);

  const openHanjaModal = useCallback(
    async (char, type, index) => {
      if (!isDbReady || !char) {
        return;
      }

      const results =
        type === 'last'
          ? await hanjaRepo.findSurnamesByHangul(char)
          : await hanjaRepo.findByHangul(char);

      setHanjaOptions(Array.isArray(results) ? results : []);
      setModalTarget({ type, index, char });
      setIsModalOpen(true);
    },
    [hanjaRepo, isDbReady],
  );

  const closeHanjaModal = useCallback(() => {
    setIsModalOpen(false);
    setHanjaOptions([]);
    setModalTarget(EMPTY_MODAL_TARGET);
  }, []);

  const handleSelectHanja = useCallback(
    (entry) => {
      if (!entry) {
        return;
      }

      if (modalTarget.type === 'last') {
        setSelectedSurnameEntries((previousEntries) =>
          previousEntries.map((current, index) => (index === modalTarget.index ? entry : current)),
        );
      } else {
        setSelectedFirstNameEntries((previousEntries) =>
          previousEntries.map((current, index) => (index === modalTarget.index ? entry : current)),
        );
      }

      closeHanjaModal();
    },
    [closeHanjaModal, modalTarget],
  );

  const analyzeName = useCallback(() => {
    const isComplete =
      hasAllEntriesSelected(selectedSurnameEntries) && hasAllEntriesSelected(selectedFirstNameEntries);

    if (!isComplete) {
      alert('모든 글자의 한자를 선택해 주세요.');
      return;
    }

    const [year, month, day] = birthDate.split('-').map(Number);
    const [hour, minute] = birthTime.split(':').map(Number);

    const userInfo = {
      lastName: selectedSurnameEntries,
      firstName: selectedFirstNameEntries,
      birthDateTime: { year, month, day, hour, minute },
      gender: 'female',
    };

    const result = analyzer.analyze(userInfo);
    setAnalysisResult(result ?? null);
  }, [analyzer, birthDate, birthTime, selectedFirstNameEntries, selectedSurnameEntries]);

  return {
    isDbReady,
    lastNameHangul,
    setLastNameHangul,
    firstNameHangul,
    setFirstNameHangul,
    birthDate,
    setBirthDate,
    birthTime,
    setBirthTime,
    selectedSurnameEntries,
    selectedFirstNameEntries,
    isModalOpen,
    modalTarget,
    hanjaOptions,
    analysisResult,
    openHanjaModal,
    closeHanjaModal,
    handleSelectHanja,
    analyzeName,
  };
}

