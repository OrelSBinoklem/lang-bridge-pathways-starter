import TableCard from '../../TableCard.jsx';

export default function Card12() {
  return (
    <TableCard>
      <div>
      <div className="title-banner">S2</div>
      
      <table>
        <thead>
          <tr>
            <th colSpan="8" style={{textAlign: 'left', padding: '12px 16px', fontWeight: 700, fontSize: '0.95rem'}}>
              2. DEKLINĀCIJAS LIETVĀRDI (IZŅĒMUMI) (Существительные 2-го склонения, исключения)
            </th>
          </tr>
          <tr>
            <td style={{textAlign: 'center', padding: '8px', background: 'var(--cell1)', fontSize: '0.9em', verticalAlign: 'middle'}}>
              <strong>ūdens</strong><br />
              <span style={{fontSize: '1em', color: 'var(--muted)'}}>вода</span>
            </td>
            <td style={{textAlign: 'center', padding: '8px', background: 'var(--cell1)', fontSize: '0.9em', verticalAlign: 'middle'}}>
              <strong>akmens</strong><br />
              <span style={{fontSize: '1em', color: 'var(--muted)'}}>камень</span>
            </td>
            <td style={{textAlign: 'center', padding: '8px', background: 'var(--cell1)', fontSize: '0.9em', verticalAlign: 'middle'}}>
              <strong>asmens</strong><br />
              <span style={{fontSize: '1em', color: 'var(--muted)'}}>лезвие</span>
            </td>
            <td style={{textAlign: 'center', padding: '8px', background: 'var(--cell1)', fontSize: '0.9em', verticalAlign: 'middle'}}>
              <strong>rudens</strong><br />
              <span style={{fontSize: '1em', color: 'var(--muted)'}}>осень</span>
            </td>
            <td style={{textAlign: 'center', padding: '8px', background: 'var(--cell1)', fontSize: '0.9em', verticalAlign: 'middle'}}>
              <strong>zibens</strong><br />
              <span style={{fontSize: '1em', color: 'var(--muted)'}}>молния</span>
            </td>
            <td style={{textAlign: 'center', padding: '8px', background: 'var(--cell1)', fontSize: '0.9em', verticalAlign: 'middle'}}>
              <strong>mēness</strong><br />
              <span style={{fontSize: '1em', color: 'var(--muted)'}}>луна</span>
            </td>
            <td style={{textAlign: 'center', padding: '8px', background: 'var(--cell1)', fontSize: '0.9em', verticalAlign: 'middle'}}>
              <strong>sāls</strong><br />
              <span style={{fontSize: '1em', color: 'var(--muted)'}}>соль</span>
            </td>
            <td style={{textAlign: 'center', padding: '8px', background: 'var(--cell1)', fontSize: '0.9em', verticalAlign: 'middle'}}>
              <strong>suns</strong><br />
              <span style={{fontSize: '1em', color: 'var(--muted)'}}>собака</span>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan="8" style={{textAlign: 'left', padding: '16px', lineHeight: '1.6'}}>
              Все эти слова склоняются по образцу существительных с окончанием <strong>-is</strong>.<br /><br />
              <strong>Важно:</strong> Смягчение согласной в единственном числе в форме <strong>Ģenitīvs</strong> (родительный падеж) происходит только у слова <strong><span style={{color: '#ff9800'}}>suns → suņa</span></strong>.<br />
              У остальных слов в <strong><span style={{color: '#ff9800'}}>Ģenitīvs единственного числа смягчения нет</span></strong>.
            </td>
          </tr>
        </tbody>
      </table>
      
      <details style={{marginTop: '12px'}}>
        <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
        <div className="image-container" style={{marginTop: '8px'}}>
          <div className="loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
          <img className="image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
          <a className="btn download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
        </div>
      </details>
    </div>
    </TableCard>
  );
}



