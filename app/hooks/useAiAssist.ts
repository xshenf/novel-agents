import { useState } from 'react';
import type { NovelStore } from '@/lib/store';
import type { CallAIApi } from './useAiClient';

export interface InspCharacter {
  id: string;
  checked: boolean;
  name: string;
  role: string;
  age: string;
  identity: string;
  personality: string;
  goals: string;
  currentState: string;
  forbidden: string;
}

export interface InspRule {
  id: string;
  checked: boolean;
  name: string;
  type: 'location' | 'faction' | 'rule' | 'item' | 'other';
  description: string;
}

interface CheckResult {
  passed?: boolean;
  issues: string[];
  suggestions: string[];
}

interface UseAiAssistDeps {
  store: NovelStore;
  callAIApi: CallAIApi;
  editorContent: string;
  setIsAiLoading: (loading: boolean) => void;
}

export type AiAssistApi = ReturnType<typeof useAiAssist>;

export function useAiAssist({ store, callAIApi, editorContent, setIsAiLoading }: UseAiAssistDeps) {
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);

  const [showInspirationsModal, setShowInspirationsModal] = useState(false);
  const [isInspirationLoading, setIsInspirationLoading] = useState(false);
  const [inspCharacters, setInspCharacters] = useState<InspCharacter[]>([]);
  const [inspRules, setInspRules] = useState<InspRule[]>([]);
  const [activeInspTab, setActiveInspTab] = useState<'char' | 'rule'>('char');

  // AI 写作辅助：逻辑自检
  const handleConsistencyCheck = async () => {
    if (!store.currentProject || !store.currentChapter) return;
    setIsAiLoading(true);
    setCheckResult(null);
    try {
      const res = await callAIApi({
        action: 'selfCheck',
        projectId: store.currentProject.id,
        currentText: editorContent
      });
      const data = await res.json();
      setCheckResult(data);
    } catch (err) {
      alert('逻辑自检执行失败');
    } finally {
      setIsAiLoading(false);
    }
  };

  // AI 写作辅助：自动提取摘要并更新章节状态
  const handleAutoSummarize = async () => {
    if (!editorContent.trim() || !store.currentChapter) return;
    setIsAiLoading(true);
    try {
      const res = await callAIApi({
        action: 'summarize',
        currentText: editorContent
      });
      const data = await res.json();
      if (data.summary) {
        await store.updateChapter(store.currentChapter.id, {
          summary: data.summary,
          characterChanges: data.characterChanges || [],
          newForeshadowing: data.newForeshadowing || [],
          resolvedForeshadowing: data.resolvedForeshadowing || [],
          timelineEvents: data.timelineEvents || []
        });
        alert(`章节摘要自动提取成功！\n\n【本章摘要】：${data.summary}\n【时间线事件】：${data.timelineEvents?.join(', ') || '无'}`);
      }
    } catch (err) {
      alert('自动提取摘要失败');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleOpenInspirations = async () => {
    if (!store.currentProject) return;
    setShowInspirationsModal(true);
    setIsInspirationLoading(true);
    setInspCharacters([]);
    setInspRules([]);

    try {
      const res = await callAIApi({
        action: 'generateInspirations',
        projectId: store.currentProject.id
      });
      const data = await res.json();

      if (data.characters) {
        setInspCharacters(data.characters.map((c: any, index: number) => ({
          id: `insp_char_${index}`,
          checked: true,
          name: c.name || '',
          role: c.role || '配角',
          age: c.age || '',
          identity: c.identity || '',
          personality: Array.isArray(c.personality) ? c.personality.join(', ') : (c.personality || ''),
          goals: Array.isArray(c.goals) ? c.goals.join(', ') : (c.goals || ''),
          currentState: c.currentState || '',
          forbidden: Array.isArray(c.forbidden) ? c.forbidden.join(', ') : (c.forbidden || '')
        })));
      }

      if (data.worldRules) {
        setInspRules(data.worldRules.map((r: any, index: number) => ({
          id: `insp_rule_${index}`,
          checked: true,
          name: r.name || '',
          type: r.type || 'location',
          description: r.description || ''
        })));
      }
    } catch (error) {
      alert('生成设定灵感失败，请稍后重试。');
    } finally {
      setIsInspirationLoading(false);
    }
  };

  const handleImportInspirations = async () => {
    if (!store.currentProject) return;

    const charsToImport = inspCharacters.filter(c => c.checked);
    const rulesToImport = inspRules.filter(r => r.checked);

    if (charsToImport.length === 0 && rulesToImport.length === 0) {
      alert('您没有勾选任何设定灵感！');
      return;
    }

    setIsAiLoading(true);
    try {
      // 批量创建角色
      for (const char of charsToImport) {
        await store.createCharacter({
          projectId: store.currentProject.id,
          name: char.name,
          role: char.role,
          age: char.age,
          identity: char.identity,
          personality: char.personality.split(/[,，]/).map(p => p.trim()).filter(Boolean),
          goals: char.goals.split(/[,，]/).map(g => g.trim()).filter(Boolean),
          relationships: [],
          currentState: char.currentState,
          forbidden: char.forbidden.split(/[,，]/).map(f => f.trim()).filter(Boolean)
        });
      }

      // 批量创建设定项
      for (const rule of rulesToImport) {
        await store.createWorldRule({
          projectId: store.currentProject.id,
          name: rule.name,
          type: rule.type,
          description: rule.description
        });
      }

      // 刷新数据
      await store.fetchCharacters(store.currentProject.id);
      await store.fetchWorldRules(store.currentProject.id);

      setShowInspirationsModal(false);
      alert('灵感设定导入成功！');
    } catch (err) {
      alert('导入部分或全部设定时出错');
    } finally {
      setIsAiLoading(false);
    }
  };

  return {
    checkResult,
    setCheckResult,
    handleConsistencyCheck,
    handleAutoSummarize,
    showInspirationsModal,
    setShowInspirationsModal,
    isInspirationLoading,
    inspCharacters,
    setInspCharacters,
    inspRules,
    setInspRules,
    activeInspTab,
    setActiveInspTab,
    handleOpenInspirations,
    handleImportInspirations,
  };
}
