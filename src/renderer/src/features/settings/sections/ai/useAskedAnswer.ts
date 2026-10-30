import { useEffect, useEffectEvent, useState } from 'react';

/**
 * What main answered about `subject`, asked while `isActive`: only once AI is on, so Settings
 * contacts nothing before then. A new subject, or `refresh`, asks again; an answer about
 * another subject says nothing about this one. `ask` never rejects: its service answers
 * a failure too.
 */
export function useAskedAnswer<T>(
  isActive: boolean,
  subject: string,
  ask: (isRefresh: boolean) => Promise<T>
) {
  const [refreshes, setRefreshes] = useState(0);
  const [answer, setAnswer] = useState<{ subject: string; refreshes: number; value: T } | null>(
    null
  );
  const askNow = useEffectEvent(() => ask(refreshes > 0));

  useEffect(() => {
    if (!isActive) return;
    let isCurrent = true;
    void askNow().then((value) => {
      if (isCurrent) setAnswer({ subject, refreshes, value });
    });
    return () => {
      isCurrent = false;
    };
  }, [isActive, subject, refreshes]);

  const isForSubject = answer?.subject === subject;
  return {
    value: isForSubject ? answer.value : null,
    isWaiting: isActive && !(isForSubject && answer.refreshes === refreshes),
    refresh: () => setRefreshes((count) => count + 1),
  };
}
