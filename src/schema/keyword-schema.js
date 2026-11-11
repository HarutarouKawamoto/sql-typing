import { z } from 'zod';

/**
 * data/keywords.yaml（用語辞典）の形。
 * 元：docs/functional-design.md の「エンティティ：Keyword」
 */

export const KeywordSchema = z
  .object({
    word: z
      .string()
      .regex(
        /^[A-Z][A-Z_]*( [A-Z][A-Z_]*)*$/,
        'word は大文字の英単語（複数語は半角スペース1つで区切る）',
      ),
    english: z.string().min(1),
    meaning: z.string().min(1),
    example: z.string().min(1),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  })
  .strict();

// 用語は問題を作りながら足していくので、最初は空でもよい
export const KeywordsFileSchema = z.array(KeywordSchema);

/** @typedef {import('zod').infer<typeof KeywordSchema>} Keyword */
