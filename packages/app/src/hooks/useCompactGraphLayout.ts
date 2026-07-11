import { useEffect, useState } from 'react';

const COMPACT_GRAPH_QUERY = '(width <= 900px)';

export function useCompactGraphLayout(): boolean {
  const [isCompact, setIsCompact] = useState(() => (
    typeof window !== 'undefined' && Boolean(window.matchMedia?.(COMPACT_GRAPH_QUERY).matches)
  ));

  useEffect(() => {
    const media = window.matchMedia?.(COMPACT_GRAPH_QUERY);
    if (!media) return undefined;
    const update = () => setIsCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return isCompact;
}
