import { useEffect, useRef } from 'react';
import { createRenderer } from '../engine/MotionEngine';
import type { BackdropConfig } from '../engine/types';

/** Static 160×90 still of a config, rendered after a small stagger so the UI stays responsive. */
export function Thumbnail({ cfg, delay = 0, time = 4 }: { cfg: BackdropConfig; delay?: number; time?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(cfg);
  useEffect(() => {
    const id = setTimeout(() => {
      if (!ref.current) return;
      try { createRenderer(ref.current, cfg).render(time); } catch (e) { console.error(cfg.type, e); }
    }, 120 + delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, delay, time]);
  return <canvas ref={ref} width={160} height={90} />;
}
