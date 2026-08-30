import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';

export interface GraphGestureController {
  readonly altPressedRef: MutableRefObject<boolean>;
  readonly suppressAutoFitRef: MutableRefObject<boolean>;
  suppressAutoFitForUserViewportChange(): void;
  suppressNextPaneClick(): void;
  consumeSuppressedPaneClick(): boolean;
}

/** Manages transient keyboard and viewport gesture state shared by graph handlers. */
export function useGraphGestureController(autoFitSuppressionMs = 800): GraphGestureController {
  const altPressedRef = useRef(false);
  const suppressAutoFitRef = useRef(false);
  const suppressAutoFitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextPaneClickRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Alt') altPressedRef.current = true;
    };
    const handleKeyUp = (event: KeyboardEvent): void => {
      if (event.key === 'Alt') altPressedRef.current = false;
    };
    const handleBlur = (): void => {
      altPressedRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(
    () => () => {
      if (suppressAutoFitTimerRef.current !== null) {
        clearTimeout(suppressAutoFitTimerRef.current);
      }
    },
    [],
  );

  const suppressAutoFitForUserViewportChange = useCallback(() => {
    suppressAutoFitRef.current = true;
    if (suppressAutoFitTimerRef.current !== null) {
      clearTimeout(suppressAutoFitTimerRef.current);
    }
    suppressAutoFitTimerRef.current = setTimeout(() => {
      suppressAutoFitRef.current = false;
      suppressAutoFitTimerRef.current = null;
    }, autoFitSuppressionMs);
  }, [autoFitSuppressionMs]);

  const suppressNextPaneClick = useCallback(() => {
    suppressNextPaneClickRef.current = true;
  }, []);

  const consumeSuppressedPaneClick = useCallback((): boolean => {
    if (!suppressNextPaneClickRef.current) return false;
    suppressNextPaneClickRef.current = false;
    return true;
  }, []);

  return {
    altPressedRef,
    suppressAutoFitRef,
    suppressAutoFitForUserViewportChange,
    suppressNextPaneClick,
    consumeSuppressedPaneClick,
  };
}
