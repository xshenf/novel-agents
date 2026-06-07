import { useState, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Compass, Activity, BookOpen, User, Tag, Zap, Flame, Award, Lock, Key, Trophy, CheckCircle2, Globe, Palette
} from 'lucide-react';

export type OutlineSubTab = 'kernel' | 'volume' | 'chapter' | 'assets';

export interface MaterialItem {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  group?: string; // 所属分组
}

// 世界素材磁贴分组
export const MATERIAL_GROUPS: Array<{ key: string; label: string }> = [
  { key: 'kernel', label: '核心设定' },
  { key: 'world', label: '世界资产' },
  { key: 'story', label: '人物剧情' },
];

// 世界素材磁贴清单。「分卷大纲」承载分卷/章节大纲的查看、编辑与（AI/手动）管理；
// 左侧 WorkspaceSidebar 仅做分卷-章节的浏览与跳转。
export const MATERIALS_LIST: MaterialItem[] = [
  // 核心设定
  { id: 'styleSetting', label: '风格基调', icon: Palette, color: '#a78bfa', group: 'kernel' },
  { id: 'worldSetting', label: '世界观设定', icon: Compass, color: '#38bdf8', group: 'kernel' },
  { id: 'coreConflict', label: '核心冲突', icon: Activity, color: '#f43f5e', group: 'kernel' },
  { id: 'sellingPoints', label: '爽点卖点', icon: Trophy, color: '#eab308', group: 'kernel' },
  { id: 'powerSystem', label: '力量体系', icon: Flame, color: '#f97316', group: 'kernel' },
  { id: 'specialSetting', label: '特殊设定', icon: Lock, color: '#14b8a6', group: 'kernel' },
  // 世界资产
  { id: 'skillSystem', label: '功法体系', icon: Award, color: '#ec4899', group: 'world' },
  { id: 'location', label: '地理地图', icon: BookOpen, color: '#10b981', group: 'world' },
  { id: 'faction', label: '势力阵营', icon: User, color: '#a855f7', group: 'world' },
  { id: 'currency', label: '货币体系', icon: Tag, color: '#eab308', group: 'world' },
  { id: 'item', label: '物品列表', icon: Zap, color: '#3b82f6', group: 'world' },
  // 人物剧情
  { id: 'character', label: '角色管理', icon: User, color: '#06b6d4', group: 'story' },
  { id: 'relation', label: '人物关系图', icon: Activity, color: '#84cc16', group: 'story' },
  { id: 'foreshadow', label: '伏笔管理', icon: Key, color: '#f59e0b', group: 'story' },
  { id: 'plot', label: '情节脉络', icon: Trophy, color: '#ef4444', group: 'story' },
  { id: 'subPlot', label: '支线故事', icon: Compass, color: '#8b5cf6', group: 'story' },
  { id: 'timeline', label: '时间线', icon: Activity, color: '#06b6d4', group: 'story' },
  { id: 'events', label: '已经历事件', icon: CheckCircle2, color: '#22c55e', group: 'story' },
  { id: 'worldState', label: '世界状态', icon: Globe, color: '#22d3ee', group: 'story' },
];

// 从 MATERIALS_LIST 的 group 字段派生资产类素材 ID 集合（group 为 'world' 或 'story' 的属于资产），
// 避免与列表定义不同步。
const ASSET_MATERIAL_IDS = new Set(
  MATERIALS_LIST.filter(m => m.group === 'world' || m.group === 'story').map(m => m.id)
);

// 管理素材磁贴选中态、当前子 Tab 与大纲搜索
export function useMaterialTabs(urlMaterial?: string | null) {
  const [outlineSubTab, setOutlineSubTab] = useState<OutlineSubTab>('kernel');
  const [activeMaterial, setActiveMaterial] = useState<string>(urlMaterial || 'styleSetting');
  const [collapsedVolumes, setCollapsedVolumes] = useState<Record<number, boolean>>({});
  const [outlineSearchQuery, setOutlineSearchQuery] = useState('');

  // 选择素材磁贴时统一控制跳转
  const handleSelectMaterial = useCallback((material: string) => {
    if (ASSET_MATERIAL_IDS.has(material)) {
      setActiveMaterial(material);
      setOutlineSubTab('assets');
      return;
    }
    // 核心设定类
    setActiveMaterial(material);
    setOutlineSubTab('kernel');
  }, []);

  return {
    outlineSubTab, setOutlineSubTab,
    activeMaterial, setActiveMaterial,
    collapsedVolumes, setCollapsedVolumes,
    outlineSearchQuery, setOutlineSearchQuery,
    handleSelectMaterial,
  };
}
