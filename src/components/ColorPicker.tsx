import { useState, useEffect, useRef } from 'react';

const DEFAULT_COLOR = '#5B9BD5';

function getSavedColor(): string {
  try {
    return localStorage.getItem('myworkout-color') || DEFAULT_COLOR;
  } catch { return DEFAULT_COLOR; }
}

function saveColor(color: string) {
  try { localStorage.setItem('myworkout-color', color); } catch {}
}

export { getSavedColor };

export default function ColorPickerBtn() {
  const [color, setColor] = useState(getSavedColor);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyColor(color);
  }, [color]);

  useEffect(() => {
    function click(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('click', click);
    return () => document.removeEventListener('click', click);
  }, [open]);

  function applyColor(c: string) {
    const root = document.documentElement;
    // 根据主色计算衍生色
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    const darken = (amt: number) =>
      `rgb(${Math.max(0, r - amt)},${Math.max(0, g - amt)},${Math.max(0, b - amt)})`;
    const lighten = (amt: number) =>
      `rgb(${Math.min(255, r + amt)},${Math.min(255, g + amt)},${Math.min(255, b + amt)})`;

    root.style.setProperty('--primary', c);
    root.style.setProperty('--primary-dark', darken(40));
    root.style.setProperty('--primary-light', lighten(90));
  }

  function handleChange(c: string) {
    setColor(c);
    saveColor(c);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
          padding: '4px 6px', borderRadius: 6, lineHeight: 1,
        }}
        title="调色"
      >🎨</button>
      {open && (
        <div style={{
          position: 'absolute', top: 38, right: 0,
          background: 'var(--white)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 12, zIndex: 200,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}>
          <input
            type="color"
            value={color}
            onChange={(e) => handleChange(e.target.value)}
            style={{ width: 40, height: 40, border: 'none', cursor: 'pointer', background: 'none' }}
          />
        </div>
      )}
    </div>
  );
}
