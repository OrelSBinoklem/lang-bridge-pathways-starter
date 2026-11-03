import TableCard from '../../TableCard.jsx';
import './TableAdverbsTenses.css';
export default function TableAdverbsTenses() {
  return (
    <TableCard>
      <div className="card table-adverbs-tenses" id="adverbs-tenses-table-container">
      <div className="title-banner" style={{background: '#2d5016'}}>28. nodarbība</div>
      <h2 style={{margin: '0 0 12px 0', fontSize: '1.1rem'}}>Apstākļa vārdi ar trim laikiem (Наречия с тремя временами)</h2>
      <p style={{margin: '0 0 16px 0', color: 'var(--muted)', fontSize: '0.9rem'}}>Наречия, которые используются с глаголами в настоящем, прошедшем и будущем времени.</p>

      {/* Таблица только с наречиями: Прошедшее | Настоящее | Будущее */}
      <table className="adverbs-tenses" id="adverbs-tenses-table">
        <thead>
          <tr>
            <th className="tense-header" style={{background: '#fff3e0'}}>Pagātne<br /><span style={{fontWeight: 'normal', fontSize: '0.85rem', color: 'var(--muted)'}}>(Прошедшее)</span></th>
            <th className="tense-header" style={{background: '#e3f2fd'}}>Tagadne<br /><span style={{fontWeight: 'normal', fontSize: '0.85rem', color: 'var(--muted)'}}>(Настоящее)</span></th>
            <th className="tense-header" style={{background: '#e8f5e9'}}>Nākotne<br /><span style={{fontWeight: 'normal', fontSize: '0.85rem', color: 'var(--muted)'}}>(Будущее)</span></th>
          </tr>
          <tr>
            <th className="col-adverb">Наречие (lv — ru)</th>
            <th className="col-adverb">Наречие (lv — ru)</th>
            <th className="col-adverb">Наречие (lv — ru)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span className="adv-lv">Vakar</span> <span className="adv-ru">— вчера</span></td>
            <td><span className="adv-lv">Tagad</span> <span className="adv-ru">— сейчас, теперь</span></td>
            <td><span className="adv-lv">Rīt</span> <span className="adv-ru">— завтра</span></td>
          </tr>
          <tr>
            <td><span className="adv-lv">Nesen</span> <span className="adv-ru">— недавно</span></td>
            <td><span className="adv-lv">Šodien</span> <span className="adv-ru">— сегодня</span></td>
            <td><span className="adv-lv">Drīz</span> <span className="adv-ru">— скоро</span></td>
          </tr>
          <tr>
            <td><span className="adv-lv">Iepriekš</span> <span className="adv-ru">— ранее, прежде</span></td>
            <td><span className="adv-lv">Pašlaik</span> <span className="adv-ru">— сейчас, в данный момент</span></td>
            <td><span className="adv-lv">Drīzumā</span> <span className="adv-ru">— в ближайшее время</span></td>
          </tr>
          <tr>
            <td><span className="adv-lv">Pagājušajā mēnesī (gadā)</span> <span className="adv-ru">— в прошлом месяце (году)</span></td>
            <td><span className="adv-lv">Ikdienā</span> <span className="adv-ru">— в повседневной жизни</span></td>
            <td><span className="adv-lv">Nākamnedēļ / Nākamgad</span> <span className="adv-ru">— на след. неделе / в след. году</span></td>
          </tr>
          <tr>
            <td><span className="adv-lv">Toreiz</span> <span className="adv-ru">— тогда, в то время</span></td>
            <td><span className="adv-lv">Patlaban</span> <span className="adv-ru">— сейчас, в данный момент</span></td>
            <td><span className="adv-lv">Pēc tam</span> <span className="adv-ru">— после этого</span></td>
          </tr>
          <tr>
            <td><span className="adv-lv">Pirms tam</span> <span className="adv-ru">— до этого</span></td>
            <td><span className="adv-lv">Šobrīd</span> <span className="adv-ru">— в настоящий момент, сейчас</span></td>
            <td><span className="adv-lv">Vēlāk</span> <span className="adv-ru">— позже</span></td>
          </tr>
          <tr>
            <td><span className="adv-lv">Agrāk</span> <span className="adv-ru">— раньше, прежде</span></td>
            <td><span className="adv-lv">Patreiz</span> <span className="adv-ru">— в данный момент, сейчас</span></td>
            <td><span className="adv-lv">Turpmāk</span> <span className="adv-ru">— в дальнейшем</span></td>
          </tr>
          <tr>
            <td><span className="adv-lv">Pirms nedēļas (mēneša, gada)</span> <span className="adv-ru">— неделю (месяц, год) назад</span></td>
            <td><span className="adv-lv">Tieši tagad</span> <span className="adv-ru">— прямо сейчас</span></td>
            <td><span className="adv-lv">Nākamreiz</span> <span className="adv-ru">— в следующий раз</span></td>
          </tr>
          <tr>
            <td><span className="adv-lv">Pirms dažām dienām</span> <span className="adv-ru">— несколько дней назад</span></td>
            <td><span className="adv-lv">Tieši šobrīd</span> <span className="adv-ru">— именно сейчас, прямо сейчас</span></td>
            <td><span className="adv-lv">Kādreiz</span> <span className="adv-ru">— когда-нибудь</span></td>
          </tr>
          <tr>
            <td><span className="adv-lv">Iepriekšējā dienā</span> <span className="adv-ru">— накануне</span></td>
            <td></td>
            <td><span className="adv-lv">Nākotnē</span> <span className="adv-ru">— в будущем</span></td>
          </tr>
          <tr>
            <td></td>
            <td></td>
            <td><span className="adv-lv">Kaut kad</span> <span className="adv-ru">— когда-то (в будущем)</span></td>
          </tr>
        </tbody>
      </table>

      {/* Примеры использования: те же 3 колонки ниже */}
      <h3 style={{margin: '24px 0 12px 0', fontSize: '1rem'}}>Piemēri (Примеры использования)</h3>
      <table className="adverbs-tenses adverbs-examples" id="adverbs-tenses-examples-table">
        <thead>
          <tr>
            <th className="tense-header" style={{background: '#fff3e0'}}>Pagātne</th>
            <th className="tense-header" style={{background: '#e3f2fd'}}>Tagadne</th>
            <th className="tense-header" style={{background: '#e8f5e9'}}>Nākotne</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Vakar es biju skolā. — Вчера я был в школе.</td>
            <td>Es tagad strādāju. — Я сейчас работаю.</td>
            <td>Viņš rīt atgriezīsies mājās. — Он завтра вернётся домой.</td>
          </tr>
          <tr>
            <td>Nesen viņa atgriezās no ceļojuma. — Недавно она вернулась из поездки.</td>
            <td>Šodien ir skaista diena. — Сегодня прекрасный день.</td>
            <td>Drīz būs vakars. — Скоро будет вечер.</td>
          </tr>
          <tr>
            <td>Iepriekš es dzīvoju Rīgā. — Раньше я жил в Риге.</td>
            <td>Pašlaik viņš mācās latviešu valodu. — Сейчас он учит латышский язык.</td>
            <td>Drīzumā viņi apprecēsies. — В ближайшее время они поженятся.</td>
          </tr>
          <tr>
            <td>Pagājušajā mēnesī viņš devās uz ārzemēm. — В прошлом месяце он уехал за границу.</td>
            <td>Ikdienā es strādāju no rīta. — В повседневной жизни я работаю с утра.</td>
            <td>Nākamnedēļ sāksies eksāmeni. — На следующей неделе начнутся экзамены.</td>
          </tr>
          <tr>
            <td>Toreiz mēs vēl nebijām paziņas. — Тогда мы ещё не были знакомы.</td>
            <td>Patlaban viņa ir aizņemta. — Сейчас она занята.</td>
            <td>Pēc tam mēs apspriedīsim plānus. — После этого мы обсудим планы.</td>
          </tr>
          <tr>
            <td>Pirms tam es nekad nebiju bijis Latvijā. — До этого я никогда не был в Латвии.</td>
            <td>Šobrīd viņš runā pa tālruni. — Он сейчас говорит по телефону.</td>
            <td>Vēlāk es tev pateikšu. — Позже я тебе скажу.</td>
          </tr>
          <tr>
            <td>Agrāk šeit bija mežs. — Раньше здесь был лес.</td>
            <td>Patreiz es nevaru runāt. — В данный момент я не могу говорить.</td>
            <td>Turpmāk es būšu uzmanīgāks. — В дальнейшем я буду внимательнее.</td>
          </tr>
          <tr>
            <td>Viņi satikās pirms nedēļas. — Они встретились неделю назад.</td>
            <td>Tieši tagad es to daru. — Прямо сейчас я это делаю.</td>
            <td>Nākamreiz es nākšu agrāk. — В следующий раз я приду раньше.</td>
          </tr>
          <tr>
            <td>Pirms dažām dienām es viņu redzēju. — Несколько дней назад я его видел.</td>
            <td>Tieši šobrīd viņa gaida autobusu. — Именно сейчас она ждёт автобус.</td>
            <td>Kādreiz es uzrakstīšu grāmatu. — Когда-нибудь я напишу книгу.</td>
          </tr>
          <tr>
            <td>Iepriekšējā dienā viņš bija slims. — Накануне он был болен.</td>
            <td></td>
            <td>Nākotnē es gribu kļūt par ārstu. — В будущем я хочу стать врачом.</td>
          </tr>
          <tr>
            <td></td>
            <td></td>
            <td>Kaut kad mēs atkal satiksimies. — Когда-то мы снова встретимся.</td>
          </tr>
          <tr>
            <td>Vakar viņi ēda pusdienas kopā. — Вчера они обедали вместе.</td>
            <td>Tagad laiks ir pulksten divi. — Сейчас время два часа.</td>
            <td>Rīt es aizbraukšu uz Jūrmalu. — Завтра я уеду в Юрмалу.</td>
          </tr>
          <tr>
            <td>Nesen mēs iegādājāmies jaunu auto. — Недавно мы купили новую машину.</td>
            <td>Šodien viņa ir ļoti laimīga. — Сегодня она очень счастлива.</td>
            <td>Drīz sāksies koncerts. — Скоро начнётся концерт.</td>
          </tr>
          <tr>
            <td>Iepriekš es strādāju bankā. — Раньше я работал в банке.</td>
            <td>Pašlaik mācības ir tiešsaistē. — Сейчас учёба проходит онлайн.</td>
            <td>Drīzumā būs ziemas brīvdienas. — В ближайшее время будут зимние каникулы.</td>
          </tr>
          <tr>
            <td>Pagājušajā gadā viņa apprecējās. — В прошлом году она вышла замуж.</td>
            <td>Ikdienā es dzeru kafiju no rīta. — В повседневной жизни я пью кофе по утрам.</td>
            <td>Nākamgad mēs brauksim uz Itāliju. — В следующем году мы поедем в Италию.</td>
          </tr>
          <tr>
            <td>Toreiz bērni vēl gulēja. — Тогда дети ещё спали.</td>
            <td>Patlaban es nevaru atbildēt. — Сейчас я не могу ответить.</td>
            <td>Pēc tam mēs iesim uz kafiju. — После этого мы пойдём на кофе.</td>
          </tr>
          <tr>
            <td>Pirms tam viņš nekad nebija bijis ārzemēs. — До этого он никогда не был за границей.</td>
            <td>Šobrīd nav brīvu vietu. — В настоящий момент нет свободных мест.</td>
            <td>Vēlāk es tev zvanīšu. — Позже я тебе позвоню.</td>
          </tr>
          <tr>
            <td>Agrāk šeit bija veikals. — Раньше здесь был магазин.</td>
            <td>Patreiz viņš strādā mājās. — В данный момент он работает дома.</td>
            <td>Turpmāk es vairāk lasīšu. — В дальнейшем я буду больше читать.</td>
          </tr>
          <tr>
            <td>Pirms mēneša es sāku mācīties latviešu valodu. — Месяц назад я начал учить латышский.</td>
            <td>Tieši tagad viņa ēd. — Прямо сейчас она ест.</td>
            <td>Nākamreiz es atcerēšos. — В следующий раз я запомню.</td>
          </tr>
          <tr>
            <td>Pirms dažām stundām bija lietus. — Несколько часов назад был дождь.</td>
            <td>Tieši šobrīd es rakstu vēstuli. — Именно сейчас я пишу письмо.</td>
            <td>Kādreiz tu sapratīsi. — Когда-нибудь ты поймёшь.</td>
          </tr>
        </tbody>
      </table>
    </div>
    </TableCard>
  );
}



