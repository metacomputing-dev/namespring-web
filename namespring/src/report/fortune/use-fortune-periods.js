import { useMemo, useRef, useState } from 'react';
import {
  asArray,
  buildCategoryItems,
  buildLifeFlowPoints,
  buildPeriodOptions,
  categoryDetailKey,
  collectExpertTags,
} from './fortune-periods';

/**
 * Selection + detail state for the life-flow and period sections. One shared
 * instance keeps a single detail panel open across both sections, matching
 * the legacy combined report behavior.
 */
export function useFortunePeriods(fortuneReport) {
  const [selectedPeriodKey, setSelectedPeriodKey] = useState('today');
  const [selectedLifePeriodKey, setSelectedLifePeriodKey] = useState('');
  const [activeDetail, setActiveDetail] = useState(null);
  const [expertTagState, setExpertTagState] = useState({ status: 'idle', tags: [] });
  const expertTagRequestRef = useRef(0);

  const periodOptions = useMemo(() => buildPeriodOptions(fortuneReport), [fortuneReport]);
  const primaryPeriodOptions = useMemo(
    () => periodOptions.filter((item) => !item.isLifeStage).slice(0, 4),
    [periodOptions],
  );
  const lifePeriodOptions = useMemo(
    () => periodOptions.filter((item) => item.isLifeStage),
    [periodOptions],
  );
  const selectedPeriod = primaryPeriodOptions.find((item) => item.key === selectedPeriodKey)
    || primaryPeriodOptions[0]
    || null;
  // Until the user picks a daeun, land on the one containing their current
  // age (the engine ships lifeCurve.currentAge), not the first daeun.
  const defaultLifePeriodKey = useMemo(() => {
    const currentAge = Number(fortuneReport?.lifeCurve?.currentAge);
    if (!Number.isFinite(currentAge)) return '';
    const currentPoint = asArray(fortuneReport?.lifeCurve?.points)
      .find((point) => Number(point?.age) === currentAge && Number.isFinite(point?.daeunIndex));
    if (currentPoint) return `life-daeun-${currentPoint.daeunIndex}`;
    const byAge = lifePeriodOptions.find((option) => (
      Number.isFinite(option.startAge)
      && Number.isFinite(option.endAge)
      && currentAge >= option.startAge
      && currentAge < option.endAge
    ));
    return byAge?.key || '';
  }, [fortuneReport, lifePeriodOptions]);
  const selectedLifePeriod = lifePeriodOptions.find((item) => item.key === selectedLifePeriodKey)
    || lifePeriodOptions.find((item) => item.key === defaultLifePeriodKey)
    || lifePeriodOptions[0]
    || null;
  const selectedCategoryItems = useMemo(
    () => buildCategoryItems(selectedPeriod),
    [selectedPeriod],
  );
  const selectedLifeCategoryItems = useMemo(
    () => buildCategoryItems(selectedLifePeriod),
    [selectedLifePeriod],
  );
  const selectedLifeFlowKey = selectedLifePeriod?.key || selectedLifePeriodKey;
  const lifeFlowPoints = useMemo(() => {
    return buildLifeFlowPoints(lifePeriodOptions, fortuneReport?.lifeCurve).map((point) => ({
      ...point,
      isSelected: point.isSelected || point.key === selectedLifeFlowKey,
    }));
  }, [lifePeriodOptions, fortuneReport, selectedLifeFlowKey]);

  const resetDetail = () => {
    setActiveDetail(null);
    expertTagRequestRef.current += 1;
    setExpertTagState({ status: 'idle', tags: [] });
  };

  const selectPeriod = (periodKey) => {
    setSelectedPeriodKey(periodKey);
    resetDetail();
  };

  const selectLifePeriod = (periodKey) => {
    setSelectedLifePeriodKey(periodKey);
    resetDetail();
  };

  const toggleCategoryDetail = (periodOption, categoryItem) => {
    const key = categoryDetailKey(periodOption, categoryItem);
    if (activeDetail?.key === key) {
      resetDetail();
      return;
    }
    if (!periodOption || !categoryItem?.cell) return;
    setActiveDetail({
      key,
      periodLabel: periodOption.periodLabel || periodOption.label,
      categoryTitle: categoryItem.title,
      cell: categoryItem.cell,
    });
    setExpertTagState({ status: 'loading', tags: [] });
    const requestId = expertTagRequestRef.current + 1;
    expertTagRequestRef.current = requestId;
    window.setTimeout(() => {
      if (expertTagRequestRef.current !== requestId) return;
      setExpertTagState({
        status: 'ready',
        tags: collectExpertTags(categoryItem.cell, fortuneReport?.tieredMatrix?.glossary),
      });
    }, 0);
  };

  return {
    primaryPeriodOptions,
    lifePeriodOptions,
    lifeCurveWeights: fortuneReport?.lifeCurve?.weights || null,
    selectedPeriod,
    selectedLifePeriod,
    selectedCategoryItems,
    selectedLifeCategoryItems,
    lifeFlowPoints,
    activeDetail,
    expertTagState,
    selectPeriod,
    selectLifePeriod,
    toggleCategoryDetail,
  };
}
