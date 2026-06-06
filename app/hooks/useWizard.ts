import { useState, useEffect } from 'react';
import type { NovelStore } from '@/lib/store';
import type { CallAIApi } from './useAiClient';

export interface WizardResult {
  title: string;
  description: string;
  styleSetting: string;
  worldSetting: string;
}

interface UseWizardDeps {
  store: NovelStore;
  callAIApi: CallAIApi;
  router: { push: (href: string) => void };
  buildWorkspaceUrl: (projectId: string, tab?: string, chapterId?: string) => string;
  setIsAiLoading: (loading: boolean) => void;
}

export type WizardApi = ReturnType<typeof useWizard>;

export function useWizard({ store, callAIApi, router, buildWorkspaceUrl, setIsAiLoading }: UseWizardDeps) {
  const [isWizardMode, setIsWizardMode] = useState(false);
  const [selectedGenreCategory, setSelectedGenreCategory] = useState('xuanhuan');
  const [customGenreInput, setCustomGenreInput] = useState('');
  const [customToneInput, setCustomToneInput] = useState('');

  const [wizardStep, setWizardStep] = useState(1);
  const [selectedGenre, setSelectedGenre] = useState('仙侠修真');
  const [selectedTone, setSelectedTone] = useState('传统正剧');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardResult, setWizardResult] = useState<WizardResult | null>(null);
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

  const handleOpenWizard = () => {
    setWizardStep(1);
    setSelectedGenre('仙侠修真');
    setSelectedTone('传统正剧');
    setSelectedTags([]);
    setWizardResult(null);
    setWizardLoading(false);
    setCustomGenreInput('');
    setCustomToneInput('');
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

      // 默认空目录
      await store.createChapter(newProj.id, '第一章：启程');
      await store.createChapter(newProj.id, '第二章：变局');
      await store.createChapter(newProj.id, '第三章：抉择');

      setIsWizardMode(false);
      store.setCurrentProject(newProj);
      router.push(buildWorkspaceUrl(newProj.id, 'write'));
      alert("已跳过向导！已为您创建一个初始项目《未命名故事》，并在左侧生成了前三章的初始目录，您可以在左侧设定库中慢慢补充各种故事背景设定。");
    } catch (err) {
      alert("直接建书失败");
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
    setWizardLoading(true);
    setWizardResult(null);
    try {
      const res = await callAIApi({
        action: 'autoPlanBook',
        genre: selectedGenre,
        tone: selectedTone,
        tags: selectedTags
      });
      const data = await res.json();
      if (data.title) {
        setWizardResult({
          title: data.title,
          description: data.description || '',
          styleSetting: data.styleSetting || '',
          worldSetting: data.worldSetting || ''
        });
        setWizardStep(4);
      } else {
        alert('推演新书规划失败，请稍后重试。');
      }
    } catch (e) {
      alert('推演超时，请检查网络设置。');
    } finally {
      setWizardLoading(false);
    }
  };

  const handleWizardCreateProject = async () => {
    if (!wizardResult) return;
    setIsAiLoading(true);
    try {
      const newProj = await store.createProject(
        wizardResult.title,
        wizardResult.description,
        wizardResult.styleSetting,
        wizardResult.worldSetting
      );

      // 根据题材自动设置不同的前三章标题（更完整、贴切！）
      let ch1 = '第一章：深夜古卷的惊变';
      let ch2 = '第二章：试探与杀机';
      let ch3 = '第三章：因果暗局';

      if (selectedGenre === '悬疑惊悚') {
        ch1 = '第一章：雨夜里的失魂人';
        ch2 = '第二章：死档阁的红漆印';
        ch3 = '第三章：步步追命的规则';
      } else if (selectedGenre === '科幻未来') {
        ch1 = '第一章：深空舱室的冷苏醒';
        ch2 = '第二章：指令异常与逃逸';
        ch3 = '第三章：宇宙边缘的未知警告';
      } else if (selectedGenre === '现代言情' || selectedGenre === '古代言情') {
        ch1 = '第一章：死局重生的契机';
        ch2 = '第二章：豪门门阀的刁难';
        ch3 = '第三章：针锋相对的交手';
      } else if (selectedGenre === '历史架空') {
        ch1 = '第一章：没落世子的破局策';
        ch2 = '第二章：朝堂对赌与杀机';
        ch3 = '第三章：收服旧部定乾坤';
      } else if (selectedGenre === '游戏竞技') {
        ch1 = '第一章：老将退役后的登录';
        ch2 = '第二章：神魔首测的越级杀';
        ch3 = '第三章：全服震动的首通记录';
      } else if (selectedGenre === '二次元幻想') {
        ch1 = '第一章：转生成为吐槽店长';
        ch2 = '第二章：美少女眷族的上门拜访';
        ch3 = '第三章：日常小店的鸡飞狗跳';
      }

      await store.createChapter(newProj.id, ch1);
      await store.createChapter(newProj.id, ch2);
      await store.createChapter(newProj.id, ch3);

      setIsWizardMode(false);
      store.setCurrentProject(newProj);
      router.push(buildWorkspaceUrl(newProj.id, 'write'));
      alert(`《${wizardResult.title}》项目建档成功！已自动初始化前三章大纲目录，您可以直接开启“AI自动写小说模式”进行智能连载！`);
    } catch (err) {
      alert('建档失败');
    } finally {
      setIsAiLoading(false);
    }
  };

  return {
    isWizardMode,
    setIsWizardMode,
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
    wizardResult,
    setWizardResult,
    customTagInput,
    setCustomTagInput,
    loadingTip,
    handleOpenWizard,
    handleSkipWizard,
    handleToggleTag,
    handleWizardGenerate,
    handleWizardCreateProject,
  };
}
