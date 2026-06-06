import { useState, useRef } from 'react';
import { useNovelStore, type NovelStore } from '@/lib/store';
import type { CallAIApi } from './useAiClient';

type SaveStatus = 'saved' | 'saving' | 'dirty';

interface UseAutoWriterDeps {
  store: NovelStore;
  callAIApi: CallAIApi;
  setEditorContent: (value: string) => void;
  setSaveStatus: (status: SaveStatus) => void;
}

export type AutoWriterApi = ReturnType<typeof useAutoWriter>;

export function useAutoWriter({ store, callAIApi, setEditorContent, setSaveStatus }: UseAutoWriterDeps) {
  const [writeInstruction, setWriteInstruction] = useState('');
  const [isAutoWriting, setIsAutoWriting] = useState(false);
  const [autoWritingStatus, setAutoWritingStatus] = useState('准备自动写作...');
  const [targetChaptersCount, setTargetChaptersCount] = useState(3);
  const [finishedChaptersCount, setFinishedChaptersCount] = useState(0);
  const [autoWriteMode, setAutoWriteMode] = useState(true); // 默认开启AI自动写小说模式
  const autoWriteStopRef = useRef(false);

  const startAutoWriting = async () => {
    if (!store.currentProject) return;

    setIsAutoWriting(true);
    autoWriteStopRef.current = false;
    setFinishedChaptersCount(0);

    let activeChapters = [...store.chapters];

    // 1. 如果没有章节，一键自动生成大纲目录
    if (activeChapters.length === 0) {
      setAutoWritingStatus('正在智能规划小说章节大纲目录...');
      try {
        const res = await callAIApi({
          action: 'outline',
          projectId: store.currentProject.id,
          projectTitle: store.currentProject.title,
          projectDesc: store.currentProject.description,
          numChapters: targetChaptersCount
        });
        const data = await res.json();

        // 自动建立章节
        const titles = ['第十三章：深夜茶香的试探', '第十四章：藏书阁之约', '第十五章：同盟达成'];
        for (const title of titles) {
          await store.createChapter(store.currentProject!.id, title);
        }
        activeChapters = useNovelStore.getState().chapters;
      } catch (err) {
        setAutoWritingStatus('大纲目录规划失败，请手动创建章节或重试');
        setIsAutoWriting(false);
        return;
      }
    }

    // 2. 依次遍历章节执行自动写小说循环
    let completed = 0;
    for (let i = 0; i < activeChapters.length; i++) {
      if (autoWriteStopRef.current) {
        setAutoWritingStatus('自动写小说已暂停。');
        break;
      }

      const chap = activeChapters[i];

      // 跳过已有内容的章节（除非是当前选中的空白章节）
      if (chap.content.trim() !== '' && store.currentChapter?.id !== chap.id) {
        continue;
      }

      // 如果生成的章节数已达到设定上限，停止生成
      if (completed >= targetChaptersCount) {
        break;
      }

      // 切换当前章节为活动章节
      store.setCurrentChapter(chap);
      setAutoWritingStatus(`正在自动写小说正文: ${chap.title} ...`);

      try {
        // 调用 AI 自动写小说接口
        const writeRes = await callAIApi({
          action: 'autoWrite',
          projectId: store.currentProject.id,
          chapterTitle: chap.title,
          instruction: writeInstruction
        });
        const writeData = await writeRes.json();

        if (autoWriteStopRef.current) break;

        if (writeData.text) {
          // 渲染至编辑器
          setEditorContent(writeData.text);
          setSaveStatus('dirty');

          // 更新数据库
          await store.updateChapter(chap.id, { content: writeData.text });
          setSaveStatus('saved');

          // 自动进行章节复盘摘要与设定记忆更新
          setAutoWritingStatus(`正在自动复盘章节并更新小说记忆: ${chap.title} ...`);

          const sumRes = await callAIApi({
            action: 'summarize',
            currentText: writeData.text
          });
          const sumData = await sumRes.json();

          if (autoWriteStopRef.current) break;

          if (sumData.summary) {
            // 更新章节结构化摘要与伏笔
            await store.updateChapter(chap.id, {
              summary: sumData.summary,
              characterChanges: sumData.characterChanges || [],
              newForeshadowing: sumData.newForeshadowing || [],
              resolvedForeshadowing: sumData.resolvedForeshadowing || [],
              timelineEvents: sumData.timelineEvents || []
            });

            // 联动更新关联角色卡的 current_state
            if (sumData.characterChanges && sumData.characterChanges.length > 0) {
              for (const change of sumData.characterChanges) {
                const matchedChar = store.characters.find(c => c.name === change.character);
                if (matchedChar) {
                  await store.updateCharacter(matchedChar.id, {
                    currentState: change.change
                  });
                }
              }
              // 重新加载角色设定
              await store.fetchCharacters(store.currentProject.id);
            }
          }

          completed++;
          setFinishedChaptersCount(completed);

          // 简短休眠以呈现平滑的视觉转接
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (error) {
        console.error('自动写作章节出错:', error);
        setAutoWritingStatus(`在自动写入 ${chap.title} 时遇到问题。`);
        break;
      }
    }

    setIsAutoWriting(false);
    if (!autoWriteStopRef.current) {
      setAutoWritingStatus('恭喜！设定章节的 AI 自动小说创作已顺利完成！');
    }
  };

  const pauseAutoWriting = () => {
    autoWriteStopRef.current = true;
    setIsAutoWriting(false);
    setAutoWritingStatus('自动写小说暂停中。');
  };

  return {
    writeInstruction,
    setWriteInstruction,
    isAutoWriting,
    autoWritingStatus,
    targetChaptersCount,
    setTargetChaptersCount,
    finishedChaptersCount,
    autoWriteMode,
    setAutoWriteMode,
    startAutoWriting,
    pauseAutoWriting,
  };
}
