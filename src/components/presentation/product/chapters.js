import { PRODUCT_INTRO, PRODUCT_FLOW } from './intro.jsx';
import { WORKFLOW } from './workflow.jsx';
import { CREATE_TASKS, UPDATE_CONTEXT, HANDOFF } from './raise.jsx';
import { WINNOW } from './winnow.jsx';

/**
 * The product talk, in order — the same chapter shape as the engineering
 * deck's: `{ id, name, accent, tone, beats, Scene, enter? }`. The workflow
 * comes first (context, the two-fold trick, context vs tasks), then the winnow
 * skills as one way to run it, built from the bottom: create-tasks and
 * update-context, then winnow over both. It ends
 * on the frame the engineering talk opens with, and Deck's `next` carries the
 * ticket over.
 */
export const PRODUCT_CHAPTERS = [
  ...PRODUCT_INTRO,
  ...WORKFLOW,
  ...CREATE_TASKS,
  ...UPDATE_CONTEXT,
  ...WINNOW,
  ...PRODUCT_FLOW,
  ...HANDOFF,
];
