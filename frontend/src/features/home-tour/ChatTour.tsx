'use client';

import { PageTour } from './PageTour';
import { CHAT_TOUR, CHAT_TOUR_RELEASE } from './chatTourSteps';

const copy = {
  ru: { title: 'Тур по чату', invite: 'Показать, как общаться со мной и управлять расходом кредитов?' },
  uk: { title: 'Тур чатом', invite: 'Показати, як спілкуватися зі мною та керувати витратами кредитів?' },
};

export function ChatTour({ disabled, onActiveChange, onBeforeStart }: { disabled: boolean; onActiveChange: (active: boolean) => void; onBeforeStart: () => void }) {
  return <PageTour isAuthenticated={false} autoInvite={false} compact disabled={disabled}
    definition={CHAT_TOUR} release={CHAT_TOUR_RELEASE} eventName="lbp.chat-tour.start" entryId="chat"
    copy={copy} onActiveChange={onActiveChange} onBeforeStart={onBeforeStart} />;
}
