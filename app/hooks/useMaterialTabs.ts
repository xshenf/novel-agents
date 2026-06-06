import { useState, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Compass, Activity, BookOpen, User, Tag, Zap, Flame, Award, Lock, Key, Trophy, CheckCircle2, Layers
} from 'lucide-react';

export type OutlineSubTab = 'kernel' | 'volume' | 'chapter' | 'assets';

export interface MaterialItem {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

// 世界素材磁贴清单。「分卷大纲」承载分卷/章节大纲的查看、编辑与（AI/手动）管理；
// 左侧 WorkspaceSidebar 仅做分卷-章节的浏览与跳转。
export const MATERIALS_LIST: MaterialItem[] = [
  { id: 'worldSetting', label: '世界观设定', icon: Compass, color: '#38bdf8' },
  { id: 'coreConflict', label: '故事核心', icon: Activity, color: '#f43f5e' },
  { id: 'location', label: '地理地图', icon: BookOpen, color: '#10b981' },
  { id: 'faction', label: '势力阵营', icon: User, color: '#a855f7' },
  { id: 'currency', label: '货币体系', icon: Tag, color: '#eab308' },
  { id: 'item', label: '物品列表', icon: Zap, color: '#3b82f6' },
  { id: 'powerSystem', label: '力量体系', icon: Flame, color: '#f97316' },
  { id: 'skillSystem', label: '功法体系', icon: Award, color: '#ec4899' },
  { id: 'specialSetting', label: '特殊设定', icon: Lock, color: '#14b8a6' },
  { id: 'character', label: '角色管理', icon: User, color: '#06b6d4' },
  { id: 'relation', label: '人物关系图', icon: Activity, color: '#84cc16' },
  { id: 'foreshadow', label: '伏笔管理', icon: Key, color: '#f59e0b' },
  { id: 'plot', label: '情节脉络', icon: Trophy, color: '#ef4444' },
  { id: 'subPlot', label: '支线故事', icon: Compass, color: '#8b5cf6' },
  { id: 'timeline', label: '时间线', icon: Activity, color: '#06b6d4' },
  { id: 'events', label: '已经历事件', icon: CheckCircle2, color: '#22c55e' }
];

const ASSET_MATERIAL_IDS = new Set([
  'character', 'location', 'faction', 'item', 'currency',
  'skillSystem', 'relation', 'foreshadow', 'plot', 'subPlot',
  'timeline', 'events'
]);

// 管理素材磁贴选中态、当前子 Tab 与大纲搜索
export function useMaterialTabs() {
  const [outlineSubTab, setOutlineSubTab] = useState<OutlineSubTab>('kernel');
  const [activeMaterial, setActiveMaterial] = useState<string>('worldSetting');
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
