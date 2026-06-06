import type { NovelProject } from '../db';
import { formatAntiAiInstructions } from '../rules';

// 构建注入到「写作类」角色（writer / editor）system prompt 的项目风格上下文。
// 目的：让全书文风在生成阶段就被锚定，反 AI 规则在生成时即生效，而非留给后期润色补救。
export function buildStyleContext(project: NovelProject): string {
  const parts: string[] = [];

  const style = (project.styleSetting || '').trim();
  if (style) {
    parts.push(`【本书文风契约（贯穿全书，写作与润色都必须严格保持一致）】\n${style}`);
  }

  const antiAi = formatAntiAiInstructions(project.antiAiStyleRules);
  if (antiAi) {
    parts.push(`【反 AI 写作硬规则（生成时即须规避，不可依赖后期润色）】\n${antiAi}`);
  }

  const forbidden = (project.forbiddenSetting || '').trim();
  if (forbidden) {
    parts.push(`【注意：写作正文时禁止出现以下情节、字句或设定（自定义负向约束）】\n${forbidden}`);
  }

  return parts.join('\n\n');
}
