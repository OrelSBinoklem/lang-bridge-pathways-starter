import PolygonMark from './PolygonMark.jsx';

/** Each mark is its own absolutely positioned picture. */
export default function PolygonMarksLayer({ marks }) {
  if (!marks?.length) return null;

  return (
    <div className="polygon-overlay" aria-hidden="true">
      {marks.map((mark) => (
        <PolygonMark key={mark.id} {...mark} />
      ))}
    </div>
  );
}
