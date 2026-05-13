interface Props {
  completed: number;
  total: number;
}

export default function SetProgress({ completed, total }: Props) {
  const dots = [];
  for (let i = 0; i < total; i++) {
    dots.push(
      <span
        key={i}
        style={{
          display: 'inline-block',
          width: 14, height: 14, borderRadius: '50%',
          background: i < completed ? 'var(--success)' : 'var(--border)',
          marginRight: 6,
          transition: 'background 0.3s',
        }}
      />
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div>{dots}</div>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        {completed}/{total} 组
      </span>
    </div>
  );
}
