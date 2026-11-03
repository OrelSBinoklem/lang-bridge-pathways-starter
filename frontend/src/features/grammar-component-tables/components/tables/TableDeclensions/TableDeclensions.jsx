import './TableDeclensions.css';
﻿import TableCard from '../../TableCard.jsx';
export default function TableDeclensions() {
  return (
    <TableCard>
      <div className="card table-declensions">
    <h2>Locījumi (M+F) — склонения существительных</h2>
    <p className="muted">Таблица склонений существительных мужского и женского рода с доминирующими гласными над колонками.</p>
    <table style={{tableLayout: 'fixed'}}><colgroup><col style={{width: '170px', minWidth: '170px'}} /><col style={{width: 'calc(16.6667% - 25px)'}} /><col style={{width: 'calc(16.6667% - 25px)'}} /><col style={{width: 'calc(16.6667% - 25px)'}} /><col style={{width: 'calc(16.6667% - 25px)'}} /><col style={{width: 'calc(16.6667% - 25px)'}} /><col style={{width: 'calc(16.6667% - 25px)'}} /></colgroup>
      <thead>
        <tr className="groups"><th></th><th colSpan="3" className="tt-masculine">V</th><th colSpan="3" className="tt-feminine">S</th></tr>
      </thead>
      <tbody>
<tr className="domrow tt-dominant"><td className="group-iii tt-case-head tt-dominant"><strong className="group-iii c3">@=</strong></td><td className="group-iii tt-decl-1 tt-masculine tt-dominant">a</td><td className="group-iii tt-decl-2 tt-masculine tt-dominant">i</td><td className="group-iii tt-decl-3 tt-masculine tt-dominant">u</td><td className="group-iii tt-decl-4 tt-feminine tt-dominant">a</td><td className="group-iii tt-decl-5 tt-feminine tt-dominant">e</td><td className="group-iii tt-decl-6 tt-feminine tt-dominant">i</td></tr>
<tr className="tehnical-row tt-singular tt-nominative">
<td className="case tt-case-head tt-singular tt-nominative"><span className="lv">kas?</span></td>
<td className="tt-decl-1 tt-masculine tt-singular tt-nominative">-s, -š</td>
<td className="tt-decl-2 tt-masculine tt-singular tt-nominative">-is</td>
<td className="tt-decl-3 tt-masculine tt-singular tt-nominative">-us</td>
<td className="tt-decl-4 tt-feminine tt-singular tt-nominative">-a</td>
<td className="tt-decl-5 tt-feminine tt-singular tt-nominative">-e</td>
<td className="tt-decl-6 tt-feminine tt-singular tt-nominative">-s</td>
</tr>
<tr className="tt-singular tt-genitive">
<td className="case tt-case-head tt-singular tt-genitive"><span className="lv">kā?</span></td>
<td className="group-ii tt-decl-1 tt-masculine tt-singular tt-genitive">-<span className="at-sm">@</span></td>
<td className="cgray tt-decl-2 tt-masculine tt-singular tt-genitive"><span className="_snow-big-violette"></span>-<span className="c3" style={{padding: 0}}>a</span></td>
<td className="cgray tt-decl-3 tt-masculine tt-singular tt-genitive">-u<span className="c3" style={{padding: 0}}>s</span></td>
<td className="group-ii tt-decl-4 tt-feminine tt-singular tt-genitive">-<span className="at-sm">@</span>s</td>
<td className="cgray tt-decl-5 tt-feminine tt-singular tt-genitive">-es</td>
  <td className="cgray tt-decl-6 tt-feminine tt-singular tt-genitive">-<span className="c3" style={{padding: 0}}>s</span></td>
</tr>
<tr className="tt-singular tt-dative">
<td className="case tt-case-head tt-singular tt-dative"><span className="lv">kam?</span></td>
<td className="group-ii tt-decl-1 tt-masculine tt-singular tt-dative">-<span className="at-sm">@</span>m</td>
<td className="cgray tt-decl-2 tt-masculine tt-singular tt-dative">-im</td>
<td className="cgray tt-decl-3 tt-masculine tt-singular tt-dative">-um</td>
<td className="group-ii tt-decl-4 tt-feminine tt-singular tt-dative">-<span className="at-sm">@</span>i</td>
<td className="cgray tt-decl-5 tt-feminine tt-singular tt-dative">-ei</td>
<td className="cgray tt-decl-6 tt-feminine tt-singular tt-dative">-i<span className="c3" style={{padding: 0}}>j</span></td>
</tr>
<tr className="tt-singular tt-accusative">
<td className="case tt-case-head tt-singular tt-accusative"><span className="lv">ko?</span></td>
<td className="group-ii cgray tt-decl-1 tt-masculine tt-singular tt-accusative">-<span className="c3" style={{padding: 0}}>u</span></td>
<td className="cgray tt-decl-2 tt-masculine tt-singular tt-accusative">-<span className="c3" style={{padding: 0}}>i</span></td>
<td className="cgray tt-decl-3 tt-masculine tt-singular tt-accusative">-<span className="c3" style={{padding: 0}}>u</span></td>
<td className="cgray group-ii tt-decl-4 tt-feminine tt-singular tt-accusative">-<span className="c3" style={{padding: 0}}>u</span></td>
<td className="cgray tt-decl-5 tt-feminine tt-singular tt-accusative">-<span className="c3" style={{padding: 0}}>i</span></td>
<td className="cgray tt-decl-6 tt-feminine tt-singular tt-accusative">-<span className="c3" style={{padding: 0}}>i</span></td>
</tr>
<tr className="tt-singular tt-locative">
<td className="case tt-case-head tt-singular tt-locative"><span className="lv">kur? kad?</span></td>
<td className="group-ii tt-decl-1 tt-masculine tt-singular tt-locative">-<span className="garumzime">@</span></td>
<td className="cgray tt-decl-2 tt-masculine tt-singular tt-locative">-ī</td>
<td className="cgray tt-decl-3 tt-masculine tt-singular tt-locative">-ū</td>
<td className="group-ii tt-decl-4 tt-feminine tt-singular tt-locative">-<span className="garumzime">@</span></td>
<td className="cgray tt-decl-5 tt-feminine tt-singular tt-locative">-ē</td>
<td className="cgray tt-decl-6 tt-feminine tt-singular tt-locative">-ī</td>
</tr>
        <tr className="subhead tt-plural tt-plural-head"><td className="tt-plural-label"></td><td className="sub tt-plural-label" colSpan="6" style={{fontWeight: 'normal', background: '#ffffff', textAlign: 'center'}}>Daudzskaitlis</td></tr>
<tr className="tehnical-row tt-plural tt-nominative">
<td className="case tt-case-head tt-plural tt-nominative"><span className="lv">kas?</span></td>
<td className="tt-decl-1 tt-masculine tt-plural tt-nominative">-i</td>
<td className="cgray tt-decl-2 tt-masculine tt-plural tt-nominative"><span className="_snow-big-violette"></span>-i</td>
<td className="cgray tt-decl-3 tt-masculine tt-plural tt-nominative">-i</td>
<td className="tt-decl-4 tt-feminine tt-plural tt-nominative">-<span className="at-sm">@</span>s</td>
<td className="cgray tt-decl-5 tt-feminine tt-plural tt-nominative">-es</td>
<td className="cgray tt-decl-6 tt-feminine tt-plural tt-nominative">-is</td>
</tr>
<tr className="tt-plural tt-genitive">
<td className="case tt-case-head tt-plural tt-genitive"><span className="lv">kā?</span></td>
<td className="group-ii tt-decl-1 tt-masculine tt-plural tt-genitive">-u</td>
<td className="cgray tt-decl-2 tt-masculine tt-plural tt-genitive"><span className="_snow-big-violette"></span>-u</td>
<td className="cgray tt-decl-3 tt-masculine tt-plural tt-genitive">-u</td>
<td className="group-ii tt-decl-4 tt-feminine tt-plural tt-genitive">-u</td>
<td className="cgray tt-decl-5 tt-feminine tt-plural tt-genitive"><span className="_snow-big-violette"></span>-u</td>
<td className="cgray tt-decl-6 tt-feminine tt-plural tt-genitive"><span className="_snow-big-violette"></span>-u</td>
</tr>
<tr className="tt-plural tt-dative">
<td className="case tt-case-head tt-plural tt-dative"><span className="lv">kam?</span></td>
<td className="group-ii tt-decl-1 tt-masculine tt-plural tt-dative">-iem</td>
<td className="cgray tt-decl-2 tt-masculine tt-plural tt-dative"><span className="_snow-big-violette"></span>-iem</td>
<td className="cgray tt-decl-3 tt-masculine tt-plural tt-dative">-iem</td>
<td className="group-ii tt-decl-4 tt-feminine tt-plural tt-dative">-<span className="garumzime">@</span>m</td>
<td className="cgray tt-decl-5 tt-feminine tt-plural tt-dative">-ēm</td>
<td className="cgray tt-decl-6 tt-feminine tt-plural tt-dative">-īm</td>
</tr>
<tr className="tt-plural tt-accusative">
<td className="case tt-case-head tt-plural tt-accusative"><span className="lv">ko?</span></td>
<td className="group-ii tt-decl-1 tt-masculine tt-plural tt-accusative">-us</td>
<td className="cgray tt-decl-2 tt-masculine tt-plural tt-accusative"><span className="_snow-big-violette"></span>-us</td>
<td className="cgray tt-decl-3 tt-masculine tt-plural tt-accusative">-us</td>
<td className="group-ii tt-decl-4 tt-feminine tt-plural tt-accusative">-<span className="at-sm">@</span>s</td>
<td className="cgray tt-decl-5 tt-feminine tt-plural tt-accusative">-es</td>
<td className="cgray tt-decl-6 tt-feminine tt-plural tt-accusative">-is</td>
</tr>
<tr className="tt-plural tt-locative">
<td className="case tt-case-head tt-plural tt-locative"><span className="lv">kur? kad?</span></td>
<td className="group-ii tt-decl-1 tt-masculine tt-plural tt-locative">-os</td>
<td className="cgray tt-decl-2 tt-masculine tt-plural tt-locative"><span className="_snow-big-violette"></span>-os</td>
<td className="cgray tt-decl-3 tt-masculine tt-plural tt-locative">-os</td>
<td className="group-ii tt-decl-4 tt-feminine tt-plural tt-locative">-<span className="garumzime">@</span>s</td>
<td className="cgray tt-decl-5 tt-feminine tt-plural tt-locative">-ēs</td>
<td className="cgray tt-decl-6 tt-feminine tt-plural tt-locative">-īs</td>
</tr>
      </tbody>
    </table>
  </div>
    </TableCard>
  );
}



