import { z } from 'zod';

/**
 * 問題YAML（data/problems/<章id>/<2桁>-<英語>.yaml）の形。
 * 1ファイルの中で決まる制約だけをここに書く。ファイルをまたぐ制約は cross-checks.js。
 * 元：docs/functional-design.md の「エンティティ：Problem」
 */

/** SQL・選択肢に使ってよい文字（英数字・記号・空白・改行）。日本語入力の判定を避けるため（決定13） */
const SQL_TEXT = /^[\x20-\x7E\n\r\t]*$/;
const SQL_TEXT_MESSAGE = 'SQLと選択肢には英語・数字・記号だけを使う（日本語は不可）';

const sqlText = () => z.string().min(1).regex(SQL_TEXT, SQL_TEXT_MESSAGE);

export const LineSchema = z
  .object({
    speaker: z.string().min(1),
    text: z.string().min(1).max(40, '会話の1行は40文字以内'),
  })
  .strict();

export const StorySchema = z
  .object({
    before: z.array(LineSchema).min(3, '依頼の会話は3行以上').max(12, '依頼の会話は12行以内'),
    after: z.array(LineSchema).min(1, '反応の会話は1行以上').max(4, '反応の会話は4行以内'),
  })
  .strict();

export const SetupSchema = z
  .object({
    extraSql: z.string().min(1).optional(),
  })
  .strict();

export const ChoiceSchema = z
  .object({
    text: sqlText(),
    why: z.string().min(1),
  })
  .strict();

export const BlankSchema = z
  .object({
    answer: sqlText(),
    wrong: z
      .array(ChoiceSchema)
      .min(1, '間違いの選択肢は1つ以上')
      .max(3, '間違いの選択肢は3つまで'),
  })
  .strict();

export const JudgeRuleSchema = z
  .object({
    ordered: z.boolean(),
    checkColumnNames: z.boolean().default(false),
    require: z.array(z.string().min(1)).default([]),
    forbid: z.array(z.string().min(1)).default([]),
    compareTable: z.string().min(1).optional(),
  })
  .strict();

export const PROBLEM_KINDS = /** @type {const} */ (['normal', 'composite', 'turningPoint']);

export const ProblemSchema = z
  .object({
    id: z.string().regex(/^[a-z]+-\d{2}$/, '問題IDは <章id>-<2桁の番号>（例 beginner-03）'),
    chapterId: z.string().min(1),
    order: z.number().int().positive(),
    title: z.string().min(1),
    kind: z.enum(PROBLEM_KINDS),
    story: StorySchema,
    setup: SetupSchema.default({}),
    answer: sqlText().refine((sql) => !sql.trim().endsWith(';'), '正解SQLの末尾に ; は付けない'),
    display: sqlText().optional(),
    blanks: z.array(BlankSchema).min(1, '空欄は1つ以上').max(3, '空欄は3つまで'),
    hints: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
    judge: JudgeRuleSchema,
    keywords: z
      .array(z.string().min(1))
      .min(1)
      .refine((list) => new Set(list).size === list.length, 'keywords に同じ語を2回書かない'),
  })
  .strict()
  .superRefine((problem, ctx) => {
    // 依頼の会話は 3〜8 行。ターニングポイントだけは山場なので 12 行まで（10 行程度を想定）
    const max = problem.kind === 'turningPoint' ? 12 : 8;
    if (problem.story.before.length > max) {
      ctx.addIssue({
        code: 'custom',
        path: ['story', 'before'],
        message: `依頼の会話は ${max} 行以内（${problem.kind}）`,
      });
    }
  });

/** @typedef {import('zod').infer<typeof ProblemSchema>} Problem */
/** @typedef {import('zod').infer<typeof BlankSchema>} Blank */
/** @typedef {import('zod').infer<typeof JudgeRuleSchema>} JudgeRule */
