import { z } from 'zod';

/**
 * localStorage の学習記録（キー sql-typing:progress）の形。
 * 形を変えるときは version を上げ、ProgressStore に古い形からの移し替えを書く。
 * 元：docs/functional-design.md の「エンティティ：Progress」
 */

const count = () => z.number().int().nonnegative();

export const BestSchema = z
  .object({
    timeMs: count(),
    cpm: z.number().nonnegative().optional(),
    accuracy: z.number().min(0).max(100).optional(),
    rank: z.enum(['S', 'A', 'B', 'C']).optional(),
    runs: count().optional(),
    hintsOpened: count().optional(),
  })
  .strict();

export const ModeRecordSchema = z
  .object({
    cleared: z.boolean(),
    plays: count(),
    best: BestSchema.optional(),
  })
  .strict();

export const ProblemRecordSchema = z
  .object({
    modes: z.partialRecord(z.enum(['1', '2', '3', '4']), ModeRecordSchema),
    stepReplayFinished: z.boolean(),
  })
  .strict();

export const DayLogSchema = z
  .object({
    plays: count(),
    cleared: count(),
  })
  .strict();

export const SettingsSchema = z
  .object({
    reorderAnimation: z.boolean().default(true),
    replaySpeed: z.union([z.literal(0.5), z.literal(1), z.literal(2)]).default(1),
    // 見える化D：ステップ再生の前に、結果の行の数を予想するクイズを出すか（古い記録にはないので既定で出す）
    predictionQuiz: z.boolean().default(true),
  })
  .strict();

export const ProgressSchema = z
  .object({
    version: z.literal(1),
    problems: z.record(z.string(), ProblemRecordSchema),
    mistakes: z.record(z.string(), count()),
    typed: z.record(z.string(), count()),
    days: z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), DayLogSchema),
    settings: SettingsSchema,
  })
  .strict();

/** @typedef {import('zod').infer<typeof ProgressSchema>} Progress */
