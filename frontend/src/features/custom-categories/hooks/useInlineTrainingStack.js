'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getEligibleRevertTrainingWordIds } from '../utils/helpers';

function shuffleIds(ids) {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Стек форм для inline-тренировки таблицы:
 * один заход = перемешанный список недоученных, без повторов внутри стека;
 * после опустошения — onStackExhausted (окно дообучения), новый epoch → новый стек.
 */
export default function useInlineTrainingStack({
  inlineTrainingActive,
  stackEpoch = 0,
  visibleWords,
  visibleWordIds,
  userWordsData,
  currentTime,
  groupCheck,
  onStackExhausted,
  onTrainingComplete,
  emptyStartMessage = 'Нет доступных слов для тренировки! Все формы в таблице либо изучены, либо на откате.',
}) {
  const [activeWordId, setActiveWordId] = useState(null);
  const [advanceToken, setAdvanceToken] = useState(0);
  const stackRef = useRef([]);
  const lastSubmitRef = useRef({ wordId: null, isCorrect: null });
  const userWordsDataRef = useRef(userWordsData);
  const currentTimeRef = useRef(currentTime);
  const visibleWordsRef = useRef(visibleWords);
  const visibleWordIdsRef = useRef(visibleWordIds);
  const onExhaustedRef = useRef(onStackExhausted);
  const onCompleteRef = useRef(onTrainingComplete);
  const groupCheckRef = useRef(groupCheck);
  const emptyMsgRef = useRef(emptyStartMessage);

  userWordsDataRef.current = userWordsData;
  currentTimeRef.current = currentTime;
  visibleWordsRef.current = visibleWords;
  visibleWordIdsRef.current = visibleWordIds;
  onExhaustedRef.current = onStackExhausted;
  onCompleteRef.current = onTrainingComplete;
  groupCheckRef.current = groupCheck;
  emptyMsgRef.current = emptyStartMessage;

  const collectEligible = useCallback(() => {
    return getEligibleRevertTrainingWordIds(
      visibleWordsRef.current,
      userWordsDataRef.current,
      currentTimeRef.current,
    ).filter((id) => visibleWordIdsRef.current.has(id));
  }, []);

  const rebuildStack = useCallback(() => {
    stackRef.current = shuffleIds(collectEligible());
  }, [collectEligible]);

  const popNext = useCallback(() => {
    const eligibleSet = new Set(collectEligible());
    while (stackRef.current.length > 0) {
      const id = stackRef.current.shift();
      if (eligibleSet.has(id)) return id;
    }
    return null;
  }, [collectEligible]);

  // Старт / новый цикл после окна дообучения
  useEffect(() => {
    if (!inlineTrainingActive) {
      setActiveWordId(null);
      setAdvanceToken(0);
      stackRef.current = [];
      lastSubmitRef.current = { wordId: null, isCorrect: null };
      return;
    }

    groupCheckRef.current.reset();
    rebuildStack();
    const nextId = popNext();
    if (!nextId) {
      onCompleteRef.current?.();
      if (stackEpoch === 0) {
        alert(emptyMsgRef.current);
      }
      return;
    }
    setActiveWordId(nextId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только старт / смена epoch
  }, [inlineTrainingActive, stackEpoch, rebuildStack, popNext]);

  // После ответа — следующий из стека
  useEffect(() => {
    if (!inlineTrainingActive || advanceToken === 0) return undefined;
    const { wordId, isCorrect } = lastSubmitRef.current;
    if (!wordId) return undefined;

    const delay = isCorrect ? 500 : 2500;
    const timer = setTimeout(() => {
      groupCheckRef.current.reset([wordId]);
      const nextId = popNext();
      if (!nextId) {
        setActiveWordId(null);
        onExhaustedRef.current?.();
        return;
      }
      setActiveWordId(nextId);
    }, delay);

    return () => clearTimeout(timer);
  }, [advanceToken, inlineTrainingActive, popNext]);

  const recordSubmit = useCallback((wordId, isCorrect) => {
    lastSubmitRef.current = { wordId, isCorrect };
    setAdvanceToken((t) => t + 1);
  }, []);

  return {
    activeWordId,
    setActiveWordId,
    recordSubmit,
  };
}
