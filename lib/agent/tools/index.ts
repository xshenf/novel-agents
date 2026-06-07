// Barrel exports for all agent tools

// Shared utilities and tools
export { confirmLockedAction, requestStyleInput, queryMemoryTool, getProjectOverviewTool, requestUserStyleTool } from './shared';
export type { OutlineVolume, OutlineChapter } from './shared';
export { parseStructureOutline, generateMarkdownFromSections } from './shared';

// Planner tools
export {
  generateOutlineTool,
  autoPlanBookTool,
  generateKernelTool,
  updateProjectFieldTool,
  addAntiAiRuleTool,
  getOutlineStructureTool,
  addVolumeTool,
  deleteVolumeTool,
  updateVolumeTool,
  addChapterTool,
  deleteChapterTool,
  updateChapterTool,
  moveOutlineItemTool,
} from './planner';

// Lore builder tools
export {
  createCharacterTool,
  createWorldRuleTool,
  generateInspirationsTool,
} from './loreBuilder';

// Writer tools
export {
  createChapterTool,
  autoWriteChapterTool,
  summarizeChapterTool,
} from './writer';

// Editor tools
export {
  polishTextTool,
  checkConsistencyTool,
} from './editor';

// Tool arrays (by specialist role)
import { queryMemoryTool, getProjectOverviewTool } from './shared';
import {
  generateOutlineTool,
  autoPlanBookTool,
  generateKernelTool,
  updateProjectFieldTool,
  addAntiAiRuleTool,
  getOutlineStructureTool,
  addVolumeTool,
  deleteVolumeTool,
  updateVolumeTool,
  addChapterTool,
  deleteChapterTool,
  updateChapterTool,
  moveOutlineItemTool,
} from './planner';
import {
  createCharacterTool,
  createWorldRuleTool,
  generateInspirationsTool,
} from './loreBuilder';
import {
  createChapterTool,
  autoWriteChapterTool,
  summarizeChapterTool,
} from './writer';
import {
  polishTextTool,
  checkConsistencyTool,
} from './editor';

export const PLANNER_TOOLS = [
  queryMemoryTool,
  getProjectOverviewTool,
  autoPlanBookTool,
  generateOutlineTool,
  generateKernelTool,
  updateProjectFieldTool,
  addAntiAiRuleTool,
  getOutlineStructureTool,
  addVolumeTool,
  deleteVolumeTool,
  updateVolumeTool,
  addChapterTool,
  deleteChapterTool,
  updateChapterTool,
  moveOutlineItemTool,
];

export const LORE_BUILDER_TOOLS = [
  getProjectOverviewTool,
  createCharacterTool,
  createWorldRuleTool,
  generateInspirationsTool,
  queryMemoryTool,
];

export const WRITER_TOOLS = [
  queryMemoryTool,
  getProjectOverviewTool,
  createChapterTool,
  autoWriteChapterTool,
  summarizeChapterTool,
];

export const EDITOR_TOOLS = [
  queryMemoryTool,
  getProjectOverviewTool,
  polishTextTool,
  checkConsistencyTool,
  summarizeChapterTool,
  addAntiAiRuleTool,
];

export const ALL_TOOLS = [
  ...new Set([
    ...PLANNER_TOOLS,
    ...LORE_BUILDER_TOOLS,
    ...WRITER_TOOLS,
    ...EDITOR_TOOLS,
  ])
];
