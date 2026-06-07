import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useNovelStore, type NovelStore } from '@/lib/store';
import { seedDemoData as seedDemoDataImpl } from '@/lib/seedData';

export type WorkspaceTab = 'write' | 'outline' | 'settings' | 'versions';
export type RoutingApi = ReturnType<typeof useWorkspaceRouting>;

export function useWorkspaceRouting(store: NovelStore) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>('write');

  // 保持 store 引用稳定，避免 Zustand 状态变化导致 effect 重复触发
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    setMounted(true);
  }, []);

  // 从 URL 路径中提取项目 ID
  const urlProjectId = pathname.startsWith('/project/') ? pathname.split('/project/')[1] : null;
  const urlTab = searchParams.get('tab') as WorkspaceTab | null;
  const urlChapterId = searchParams.get('chapter');
  const urlMaterial = searchParams.get('material') || null;
  
  const volumeParam = searchParams.get('volume');
  const urlVolumeIdx = volumeParam !== null ? parseInt(volumeParam, 10) : null;

  // 构建工作区 URL
  const buildWorkspaceUrl = useCallback((projectId: string, tab?: string, chapterId?: string, volumeIdx?: number | null, material?: string) => {
    const url = `/project/${projectId}`;
    const params = new URLSearchParams();
    if (tab) params.set('tab', tab);
    if (chapterId) params.set('chapter', chapterId);
    if (volumeIdx !== undefined && volumeIdx !== null) params.set('volume', String(volumeIdx));
    if (material) params.set('material', material);
    const qs = params.toString();
    return qs ? `${url}?${qs}` : url;
  }, []);

  // 预设种子演示小说数据（数据定义见 lib/seedData.ts）
  const seedDemo = useCallback(async () => {
    try {
      const s = storeRef.current;
      const { demoProj, ch13 } = await seedDemoDataImpl(s);
      router.push(buildWorkspaceUrl(demoProj.id, 'write'));
      s.setCurrentChapter(ch13);
    } catch (e) {
      console.error('Failed to seed demo data', e);
    }
  }, [router, buildWorkspaceUrl]);

  // Use ref to always call the latest seedDemo without re-running the mount effect
  const seedRef = useRef(seedDemo);
  seedRef.current = seedDemo;

  // 初始化获取项目
  // 依赖只有 urlProjectId：storeRef 保证我们总用最新的 store，但 urlProjectId 变化时才重新执行
  useEffect(() => {
    const loadProjects = () => {
      storeRef.current.fetchProjects().then(() => {
        const currentProjects = useNovelStore.getState().projects;
        if (currentProjects.length === 0) {
          seedRef.current();
        } else if (urlProjectId) {
          const currentProject = useNovelStore.getState().currentProject;
          // 如果 currentProject 未设置，或者 URL 的项目 ID 与当前不一致，则重新加载
          if (!currentProject || currentProject.id !== urlProjectId) {
            const project = currentProjects.find((p: any) => p.id === urlProjectId);
            if (project) {
              useNovelStore.getState().setCurrentProject(project);
            }
          } else {
            // currentProject 已设置且匹配，但仍需刷新数据（可能是从其他页面返回）
            storeRef.current.refreshProject(urlProjectId);
            storeRef.current.fetchChapters(urlProjectId);
            storeRef.current.fetchCharacters(urlProjectId);
            storeRef.current.fetchWorldRules(urlProjectId);
            storeRef.current.fetchWorldStates(urlProjectId);
          }
        }
      });
    };

    loadProjects();

    // 监听页面可见性变化：用户从其他标签页切回时自动刷新数据
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && urlProjectId) {
        storeRef.current.refreshProject(urlProjectId);
        storeRef.current.fetchChapters(urlProjectId);
        storeRef.current.fetchCharacters(urlProjectId);
        storeRef.current.fetchWorldRules(urlProjectId);
        storeRef.current.fetchWorldStates(urlProjectId);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [urlProjectId]); // intentionally minimal - seedRef always has latest seedDemo

  // 从 URL 恢复 tab 和 chapter 选中状态
  // 依赖 currentProjectId（原始值比较稳定）而非 store 或 store.currentProject 对象引用
  const currentProjectId = store.currentProject?.id;
  useEffect(() => {
    const currentProject = useNovelStore.getState().currentProject;
    if (!currentProject) return;
    if (urlTab) {
      if (urlTab === 'settings') {
        setActiveWorkspaceTab('outline');
      } else if (['write', 'outline', 'versions'].includes(urlTab)) {
        setActiveWorkspaceTab(urlTab as WorkspaceTab);
      }
    }
    if (urlChapterId) {
      const chapters = useNovelStore.getState().chapters;
      if (chapters.length > 0) {
        const chapter = chapters.find(c => c.id === urlChapterId);
        if (chapter) {
          storeRef.current.setCurrentChapter(chapter);
        }
      }
    }
  }, [currentProjectId, urlTab, urlChapterId]);

  return {
    router,
    urlProjectId,
    urlTab,
    urlChapterId,
    urlMaterial,
    urlVolumeIdx,
    buildWorkspaceUrl,
    mounted,
    activeWorkspaceTab,
    setActiveWorkspaceTab,
  };
}
