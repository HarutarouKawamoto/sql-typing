import { useEffect, useMemo, useState } from 'react';
import { loadProblems } from '../../data/problem-loader.js';

/**
 * 全章の問題を読み込む（一覧の題名・ターニングポイントの印・進む条件に使う）。
 * ターニングポイントかどうかは問題の kind で決まるので、読み終えるまで進む条件を決めない。
 * @param {import('../../schema/chapter-schema.js').Chapter[]} chapters
 * @returns {{ problems: Map<string, import('../../schema/problem-schema.js').Problem> | null, turningPointIds: Set<string>, error: string | null }}
 */
export function useProblems(chapters) {
  const [state, setState] = useState(
    /** @type {{ problems: Map<string, import('../../schema/problem-schema.js').Problem> | null, error: string | null }} */ ({
      problems: null,
      error: null,
    }),
  );

  useEffect(() => {
    let active = true;
    Promise.all(chapters.map((chapter) => loadProblems(chapter.id))).then(
      (lists) => {
        if (!active) return;
        setState({
          problems: new Map(lists.flat().map((problem) => [problem.id, problem])),
          error: null,
        });
      },
      (error) => {
        console.error(error);
        if (active) setState({ problems: null, error: String(error?.message ?? error) });
      },
    );
    return () => {
      active = false;
    };
  }, [chapters]);

  const turningPointIds = useMemo(
    () =>
      new Set(
        state.problems
          ? [...state.problems.values()].filter((p) => p.kind === 'turningPoint').map((p) => p.id)
          : [],
      ),
    [state.problems],
  );
  return { ...state, turningPointIds };
}
