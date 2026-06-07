/**
 * 大纲素材筛选工具函数
 * 根据素材类型过滤世界规则列表
 */

import type { WorldRule } from './db';

export function getFilteredRules(worldRules: WorldRule[] | undefined, material: string): WorldRule[] {
  if (!worldRules) return [];

  if (material === 'location') return worldRules.filter((r) => r.type === 'location');
  if (material === 'faction') return worldRules.filter((r) => r.type === 'faction');
  if (material === 'item') return worldRules.filter((r) => r.type === 'item');

  if (material === 'currency') return worldRules.filter((r) => r.type === 'rule' && r.name.includes('货币'));
  if (material === 'skillSystem') return worldRules.filter((r) => r.type === 'rule' && (r.name.includes('功法') || r.name.includes('技能') || r.name.includes('修炼') || r.name.includes('体系')));
  if (material === 'timeline') return worldRules.filter((r) => r.type === 'rule' && r.name.includes('时间线'));

  if (material === 'foreshadow') return worldRules.filter((r) => r.type === 'other' && r.name.includes('伏笔'));
  if (material === 'plot') return worldRules.filter((r) => r.type === 'other' && (r.name.includes('情节') || r.name.includes('脉络')));
  if (material === 'subPlot') return worldRules.filter((r) => r.type === 'other' && r.name.includes('支线'));
  if (material === 'events') return worldRules.filter((r) => r.type === 'other' && r.name.includes('事件'));
  if (material === 'relation') return worldRules.filter((r) => r.type === 'other' && r.name.includes('关系'));

  return worldRules;
}
