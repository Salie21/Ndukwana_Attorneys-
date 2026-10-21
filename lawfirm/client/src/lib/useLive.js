import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';

// Realtime Firestore listener. makeQuery returns a query (or null to skip). Sorting is done client-side
// so no composite indexes are needed on the free plan.
export function useLive(makeQuery, deps) {
  const [state, setState] = useState({ data: [], loading: true, error: null });
  useEffect(() => {
    const q = makeQuery();
    if (!q) { setState({ data: [], loading: false, error: null }); return undefined; }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(q,
      (snap) => setState({ data: snap.docs.map((d) => ({ id: d.id, ...d.data() })), loading: false, error: null }),
      (error) => { console.error('Live query failed:', error.code); setState({ data: [], loading: false, error }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
