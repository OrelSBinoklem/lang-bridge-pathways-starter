/** Буквы поверх таблицы (position: absolute внутри .float-letters-layer). Редактируй координаты в JSX. */
export default function FloatLettersLayer({ letters }) {
  if (!letters?.length) return null;

  return (
    <div className="float-letters-layer" aria-hidden="true">
      {letters.map(({ char, left, top, fontSize }, index) => (
        <span
          key={`${char}-${index}`}
          className="float-letter"
          style={{ left, top, fontSize: fontSize ?? '28px' }}
        >
          {char}
        </span>
      ))}
    </div>
  );
}



