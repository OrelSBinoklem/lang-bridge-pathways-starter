import { GrammarTopics } from '@/features/grammar-practice/GrammarTopics';

export default async function GrammarPracticePage({
    searchParams,
}: {
    searchParams: Promise<{ table?: string; learn_lang?: string }>;
}) {
    const params = await searchParams;
    return (
        <GrammarTopics
            learnLang={params.learn_lang === 'en' ? 'en' : 'lv'}
            tableKey={
                typeof params.table === 'string' ? params.table : undefined
            }
        />
    );
}
