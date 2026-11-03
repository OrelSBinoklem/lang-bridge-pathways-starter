'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { PageTour } from './PageTour';
import { createExamsTourDefinition, EXAMS_TOUR_RELEASE } from './examsTourSteps';

const copy = {
  ru: { title: 'Тур по экзаменам', invite: 'Показать, как устроен экзамен, без начала попытки?' },
  uk: { title: 'Тур іспитами', invite: 'Показати, як влаштований іспит, без початку спроби?' },
};

export function ExamsTour({ isAuthenticated }: { isAuthenticated: boolean }) {
  const uk = useLocale() === 'uk';
  const [definition] = useState(createExamsTourDefinition);
  const [active, setActive] = useState(false);
  return <>
    <PageTour isAuthenticated={isAuthenticated} definition={definition} release={EXAMS_TOUR_RELEASE}
      eventName="lbp.exams-tour.start" entryId="exams" copy={copy} autoInvite={false} onActiveChange={setActive} />
    {active && <aside data-exam-tour="demo" aria-label={uk ? 'Демо іспиту' : 'Демо экзамена'}
      style={{ maxWidth: 760, margin: '16px 0', padding: 14, border: '1px dashed currentColor', borderRadius: 8, fontSize: 14 }}>
      <strong>{uk ? 'Демо · лише макет, без справжньої спроби' : 'Демо · только макет, без настоящей попытки'}</strong>
      <p style={{ margin: '6px 0' }}>{uk ? 'Годинник стоїть. Кнопки вимкнені. Відповіді не записуються, мікрофон і записи іспиту не відкриваються.' : 'Часы стоят. Кнопки отключены. Ответы не записываются, микрофон и записи экзамена не открываются.'}</p>
      <p data-exam-tour="demo-skills" style={{ margin: '6px 0' }}>{uk ? 'Слухання → Читання → Письмо → Говоріння' : 'Слушание → Чтение → Письмо → Говорение'}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 10 }}>
        <div data-exam-tour="demo-timer"><strong>Демо-таймер</strong><br /><time>12:00</time> · {uk ? 'не відлічує час' : 'не отсчитывает время'}</div>
        <div data-exam-tour="demo-autosave"><strong>{uk ? 'Демо збереження' : 'Демо сохранения'}</strong><br />{uk ? 'Збереження… → Відповіді збережено' : 'Сохранение… → Ответы сохранены'}<br /><small>{uk ? 'Два приклади написів, без запиту до сервера' : 'Два примера надписей, без запроса к серверу'}</small></div>
        <div data-exam-tour="demo-listening"><button type="button" disabled><i className="pi pi-play" aria-hidden="true" /> {uk ? 'Демо: слухати' : 'Демо: слушать'}</button><br /><small>{uk ? 'Лічильник окремий для кожного завдання' : 'Счётчик отдельный для каждого задания'}</small></div>
        <div data-exam-tour="demo-speaking"><i className="pi pi-user" aria-hidden="true" /> {uk ? 'Людський аватар · макет' : 'Человеческий аватар · макет'}<br /><button type="button" disabled><i className="pi pi-microphone" aria-hidden="true" /> {uk ? 'Демо: відповісти голосом' : 'Демо: ответить голосом'}</button></div>
        <div data-exam-tour="demo-writing"><strong>Демо письма</strong><br />{uk ? 'Поле відповіді та лічильник слів' : 'Поле ответа и счётчик слов'}</div>
        <div data-exam-tour="demo-finish"><button type="button" disabled>{uk ? 'Демо: завершити частину' : 'Демо: завершить часть'}</button><br /><small>{uk ? 'Після підтвердження повернення немає' : 'После подтверждения возврата нет'}</small></div>
        <div data-exam-tour="demo-results"><strong>{uk ? 'Демо результату · вигадані дані' : 'Демо результата · вымышленные данные'}</strong><br />{uk ? 'Слухання 70% · Читання 70% · Письмо 70% · Говоріння 70%' : 'Слушание 70% · Чтение 70% · Письмо 70% · Говорение 70%'}<br /><small>{uk ? 'Мінімум 60% у кожній частині' : 'Минимум 60% в каждой части'}</small></div>
        <div data-exam-tour="demo-credits"><strong>{uk ? 'Кредити та ШІ' : 'Кредиты и ИИ'}</strong><br />{uk ? 'У цьому демо немає розпізнавання чи перевірки. В іспиті оплачується фактичне використання ШІ.' : 'В этом демо нет распознавания или проверки. В экзамене оплачивается фактическое использование ИИ.'}</div>
      </div>
    </aside>}
  </>;
}
