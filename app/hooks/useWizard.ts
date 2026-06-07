import { useState, useEffect } from 'react';
import type { NovelStore } from '@/lib/store';
import { showNotification } from '@/lib/utils';

interface UseWizardDeps {
  store: NovelStore;
  router: { push: (href: string) => void };
  buildWorkspaceUrl: (projectId: string, tab?: string, chapterId?: string) => string;
  setIsAiLoading: (loading: boolean) => void;
  onExistingProjectComplete?: () => void;
}

export type WizardApi = ReturnType<typeof useWizard>;

export function useWizard({ store, router, buildWorkspaceUrl, setIsAiLoading, onExistingProjectComplete }: UseWizardDeps) {
  const [isWizardMode, setIsWizardMode] = useState(false);
  const [existingProjectId, setExistingProjectId] = useState<string | null>(null);
  const [selectedGenreCategory, setSelectedGenreCategory] = useState('xuanhuan');
  const [customGenreInput, setCustomGenreInput] = useState('');
  const [customToneInput, setCustomToneInput] = useState('');

  const [wizardStep, setWizardStep] = useState(1);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedTone, setSelectedTone] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const [loadingTip, setLoadingTip] = useState('正在推演天机...');

  useEffect(() => {
    if (!wizardLoading) return;
    const tips = ['正在推演天机...', '正在架构宏大世界观...', '正在雕琢惊艳书名...', '正在推导主线剧情...', '正在谱写命途因果...'];
    let idx = 0;
    const timer = setInterval(() => {
      idx = (idx + 1) % tips.length;
      setLoadingTip(tips[idx]);
    }, 1200);
    return () => clearInterval(timer);
  }, [wizardLoading]);

  const handleOpenWizard = (existingId?: string) => {
    setWizardStep(1);
    setSelectedGenre('');
    setSelectedTone('');
    setSelectedTags([]);
    setWizardLoading(false);
    setCustomGenreInput('');
    setCustomToneInput('');
    setExistingProjectId(existingId || null);
    setIsWizardMode(true);
  };

  const handleSkipWizard = async () => {
    setIsAiLoading(true);
    try {
      const newProj = await store.createProject(
        "未命名故事",
        "点击左侧‘设定库’或‘项目设置’补充简介与背景设定...",
        "传统正剧",
        "待补充世界观"
      );

      setIsWizardMode(false);
      store.setCurrentProject(newProj);
      router.push(buildWorkspaceUrl(newProj.id, 'outline'));
      showNotification("已跳过向导！已为您创建一个初始项目《未命名故事》，您可以在世界设定中补充各种故事背景设定。");
    } catch (err) {
      showNotification("直接建书失败");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleWizardGenerate = async () => {
    setIsAiLoading(true);
    try {
      if (existingProjectId) {
        // 更新已有项目（从 workspace 内的向导补全）
        const updated = await store.updateProject(existingProjectId, {
          description: selectedGenre,
          styleSetting: selectedTone,
          worldSetting: selectedTags.join('、'),
        });
        setIsWizardMode(false);
        setExistingProjectId(null);
        store.setCurrentProject(updated);
        router.push(buildWorkspaceUrl(existingProjectId, 'outline'));
        onExistingProjectComplete?.();
      } else {
        // 新项目：用选择创建项目
        const newProj = await store.createProject(
          '未命名故事',
          selectedGenre,
          selectedTone,
          selectedTags.join('、')
        );
        setIsWizardMode(false);
        store.setCurrentProject(newProj);
        router.push(buildWorkspaceUrl(newProj.id, 'outline'));
      }
    } catch (err) {
      showNotification(existingProjectId ? '更新项目设定失败' : '建档失败');
    } finally {
      setIsAiLoading(false);
    }
  };

  return {
    isWizardMode,
    setIsWizardMode,
    existingProjectId,
    selectedGenreCategory,
    setSelectedGenreCategory,
    customGenreInput,
    setCustomGenreInput,
    customToneInput,
    setCustomToneInput,
    wizardStep,
    setWizardStep,
    selectedGenre,
    setSelectedGenre,
    selectedTone,
    setSelectedTone,
    selectedTags,
    setSelectedTags,
    wizardLoading,
    customTagInput,
    setCustomTagInput,
    loadingTip,
    handleOpenWizard,
    handleSkipWizard,
    handleToggleTag,
    handleWizardGenerate,
  };
}
