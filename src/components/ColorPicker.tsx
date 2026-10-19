import { useState, useEffect, useRef } from 'react';
import { CheckIcon, DropletIcon, PlusIcon } from './Icons';

const DEFAULT_COLOR = '#C9451B';
const STORAGE_KEY = 'myworkout-accent-v2';

const PRESETS = [
  { name: '焦橙', color: '#C9451B' },
  { name: '钴蓝', color: '#2F5BFF' },
  { name: '森林', color: '#1F6F50' },
  { name: '紫罗兰', color: '#6B4EFF' },
  { name: '玫瑰', color: '#C9336B' },
  { name: '琥珀', color: '#A85C00' },
];

function getSavedColor(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_COLOR;
  } catch {
    return DEFAULT_COLOR;
  }
}

function saveColor(color: string) {
  try {
    localStorage.setItem(STORAGE_KEY, color);
  } catch {
    // 忽略无痕模式下的写入失败
  }
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
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [open]);

  function applyColor(c: string) {
    const root = document.documentElement;
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

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', c);
  }

  function handleChange(c: string) {
    setColor(c);
    saveColor(c);
  }

  const preset = PRESETS.find((item) => item.color.toLowerCase() === color.toLowerCase());

  return (
    <div className="color-picker" ref={ref}>
      <button
        type="button"
        className="icon-btn color-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-label="更改强调色"
        aria-expanded={open}
      >
        <DropletIcon />
      </button>
      {open && (
        <div className="color-popover">
          <span className="eyebrow">ACCENT COLOR</span>
          <div className="swatches">
            {PRESETS.map((item) => (
              <button
                key={item.color}
                type="button"
                className={`swatch${item.color.toLowerCase() === color.toLowerCase() ? ' is-selected' : ''}`}
                style={{ background: item.color }}
                onClick={() => handleChange(item.color)}
                aria-label={item.name}
                title={item.name}
              >
                <span className="swatch-check"><CheckIcon /></span>
              </button>
            ))}
            <label className="swatch swatch-custom" title="自定义颜色">
              <input
                type="color"
                value={color}
                onChange={(e) => handleChange(e.target.value)}
                aria-label="自定义颜色"
              />
              <PlusIcon />
            </label>
          </div>
          <span className="color-name">{preset?.name ?? '自定义'}</span>
        </div>
      )}
    </div>
  );
}
