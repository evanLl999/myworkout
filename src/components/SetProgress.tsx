interface Props {
  completed: number;
  total: number;
}

export default function SetProgress({ completed, total }: Props) {
  const segments = Math.max(1, total);
  return (
    <div
      className="set-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={Math.min(completed, total)}
      aria-label={`已完成 ${completed}/${total} 组`}
    >
      {Array.from({ length: segments }).map((_, index) => (
        <span key={index} className={`set-seg ${index < completed ? 'is-filled' : ''}`} />
      ))}
    </div>
  );
}
