import { z } from 'zod';

/**
 * data/chapters.yaml の形。全章を出題順に並べる。
 * 元：docs/functional-design.md の「エンティティ：Chapter」
 */

export const CHAPTER_IDS = /** @type {const} */ (['beginner', 'intermediate', 'advanced']);

export const ChapterSchema = z
  .object({
    id: z.enum(CHAPTER_IDS),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    title: z.string().min(1),
    seed: z.string().regex(/^[a-z]+\.sql$/, '初期データは <章id>.sql'),
    tables: z.array(z.string().min(1)).min(1),
    newTables: z.array(z.string().min(1)),
    // 作っている途中の章は問題が0問のこともある
    problemIds: z.array(z.string().min(1)),
  })
  .strict()
  .refine((chapter) => chapter.newTables.every((t) => chapter.tables.includes(t)), {
    message: 'newTables は tables の中にあるテーブルだけ',
    path: ['newTables'],
  });

export const ChaptersFileSchema = z.array(ChapterSchema).min(1);

/** @typedef {import('zod').infer<typeof ChapterSchema>} Chapter */
