import { WordsBlock, type WordsBlockConfig } from './blocks/WordsBlock';
import { CustomCategoryBlock, type CustomCategoryBlockConfig } from './blocks/CustomCategoryBlock';
import { ListeningBlock, type ListeningBlockConfig } from './blocks/ListeningBlock';
import { ReadingBlock, type ReadingBlockConfig } from './blocks/ReadingBlock';
import { WritingBlock } from './blocks/WritingBlock';
import { SpeakingBlock } from './blocks/SpeakingBlock';
import type { PracticeBlockConfig } from './blocks/WritingBlock';
import type { BlockProgress } from './blocks/BinaryStatementsTask';
import type { SavedResponse, TranslationResult } from './blocks/ReadingTranslationBlock';
import type { ProductiveGrade } from './blocks/ProductiveResult';
import { GrammarTask, type GrammarConfig } from '@/features/grammar-practice/GrammarTask';
import { GrammarItemsTask } from '@/features/grammar-practice/GrammarItemsTask';

export type LessonBlockType = 'words' | 'custom_category' | 'listening' | 'reading' | 'writing' | 'speaking' | 'grammar';

export type LessonBlockData = {
  id: number;
  source_block_id?: number | null;
  type: LessonBlockType;
  title: string | null;
  variant_id: number | null;
  audit_url?: string | null;
  is_extension?: boolean;
  grammar_table_keys?: string[];
  variant_title?: string | null;
  assigned_variant_title?: string | null;
  variants?: Array<{ id: number; title: string | null; completed?: boolean }> | null;
  practice_variants?: boolean;
  is_required: boolean;
  weight: number;
  config: WordsBlockConfig | CustomCategoryBlockConfig | ListeningBlockConfig | ReadingBlockConfig | PracticeBlockConfig | Record<string, unknown>;
  bot_prompt: string | null;
  completed: boolean;
  variant_completed?: boolean;
  progress: BlockProgress;
  last_response?: SavedResponse;
  translation_result?: TranslationResult | null;
  productive_result?: ProductiveGrade | null;
};

export function renderLessonBlock(block: LessonBlockData, onRetry?: () => Promise<unknown>, grammar?: { practice: boolean; compact?: boolean; onProgress: (progress: BlockProgress) => void }, onCompletion?: () => Promise<unknown>, tutorActive = true) {
  switch (block.type) {
    case 'grammar': {
      const config = block.config as GrammarConfig;
      if (config.task_kind === 'grammar_items') return <GrammarItemsTask key={`${block.variant_id}-${grammar?.practice}`} blockId={block.id} variantId={block.variant_id} config={config} progress={block.progress} practice={grammar?.practice ?? false} onProgress={grammar?.onProgress} onRetry={onRetry} />;
      return <GrammarTask key={`${block.variant_id}-${grammar?.practice}`} blockId={block.id} variantId={block.variant_id} config={config} progress={block.progress} practice={grammar?.practice ?? false} compact={grammar?.compact} onProgress={grammar?.onProgress} onRetry={onRetry} />;
    }
    case 'words': return <WordsBlock config={block.config as WordsBlockConfig} />;
    case 'custom_category': return <CustomCategoryBlock config={block.config as CustomCategoryBlockConfig} />;
    case 'listening': return <ListeningBlock key={block.variant_id} blockId={block.id} variantId={block.variant_id} config={block.config as ListeningBlockConfig} progress={block.progress} onRetry={onRetry} onCompletion={block.practice_variants ? onCompletion : undefined} />;
    case 'reading': return <ReadingBlock key={block.variant_id} blockId={block.id} variantId={block.variant_id} config={block.config as ReadingBlockConfig} progress={block.progress} lastResponse={block.last_response ?? null} translationResult={block.translation_result} onRetry={onRetry} onCompletion={block.practice_variants ? onCompletion : undefined} repeatVariant={block.practice_variants} />;
    case 'writing': return <WritingBlock key={block.variant_id} active={tutorActive} blockId={block.id} variantId={block.variant_id} config={block.config as PracticeBlockConfig} botPrompt={block.bot_prompt} result={block.productive_result} initialCompleted={block.practice_variants ? block.variant_completed ?? false : block.completed} onCompletion={onCompletion} />;
    case 'speaking': return <SpeakingBlock key={block.variant_id} active={tutorActive} blockId={block.id} variantId={block.variant_id} config={block.config as PracticeBlockConfig} botPrompt={block.bot_prompt} result={block.productive_result} initialCompleted={block.practice_variants ? block.variant_completed ?? false : block.completed} onCompletion={onCompletion} />;
    default: return null;
  }
}
