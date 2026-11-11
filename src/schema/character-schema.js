import { z } from 'zod';

/**
 * data/characters.yaml の形。
 * 元：docs/functional-design.md の「エンティティ：Character」
 */

export const CharacterSchema = z
  .object({
    id: z.string().regex(/^[a-z]+$/, '登場人物の id は英小文字だけ'),
    name: z.string().min(1),
    role: z.string().min(1),
    color: z.string().regex(/^--[a-z0-9-]+$/, 'color は CSS 変数名（例 --color-character-tencho）'),
  })
  .strict();

export const CharactersFileSchema = z
  .array(CharacterSchema)
  .min(1)
  .refine((list) => list.some((c) => c.id === 'player'), '主人公（id: player）が必要');

/** @typedef {import('zod').infer<typeof CharacterSchema>} Character */
