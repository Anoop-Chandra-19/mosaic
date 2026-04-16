import { useCallback, useEffect, useRef, useState } from 'react';

export function useTemporaryState<T>(initialValue: T, duration: number): [T, (value: T) => void] {
  const [value, setValueRaw] = useState<T>(initialValue);
  const timeoutRef = useRef<number | null>(null);

  const setValue = useCallback(
    (next: T) => {
      setValueRaw(next);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        setValueRaw(initialValue);
      }, duration);
    },
    [initialValue, duration]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [value, setValue];
}
