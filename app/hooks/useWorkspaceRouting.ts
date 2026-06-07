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
  const seedDemo = async () => {
    try {
      const { demoProj, ch13 } = await seedDemoDataImpl(store);
      router.push(buildWorkspaceUrl(demoProj.id, 'write'));
      store.setCurrentChapter(ch13);
    } catch (e) {
      console.error('Failed to seed demo data', e);
    }
  };

  // Use ref to always call the latest seedDemo without re-running the mount effect
  const seedRef = useRef(seedDemo);
  seedRef.current = seedDemo;

  // 初始化获取项目
  useEffect(() => {
    store.fetchProjects().then(() => {
      const currentProjects = useNovelStore.getState().projects;
      if (currentProjects.length === 0) {
        seedRef.current();
      } else if (urlProjectId && !useNovelStore.getState().currentProject) {
        // 从 URL 恢复项目
        const project = currentProjects.find((p: any) => p.id === urlProjectId);
        if (project) {
          useNovelStore.getState().setCurrentProject(project);
        }
      }
    });
  }, [store, urlProjectId]); // intentionally minimal - seedRef always has latest seedDemo

  // 从 URL 恢复 tab 和 chapter 选中状态
  useEffect(() => {
    if (!store.currentProject) return;
    if (urlTab) {
      if (urlTab === 'settings') {
        setActiveWorkspaceTab('outline');
      } else if (['write', 'outline', 'versions'].includes(urlTab)) {
        setActiveWorkspaceTab(urlTab as WorkspaceTab);
      }
    }
    if (urlChapterId) {
      // Read chapters directly from store to avoid re-running on every chapter add/remove
      const chapters = useNovelStore.getState().chapters;
      if (chapters.length > 0) {
        const chapter = chapters.find(c => c.id === urlChapterId);
        if (chapter) {
          store.setCurrentChapter(chapter);
        }
      }
    }
  }, [store, store.currentProject?.id, urlTab, urlChapterId]); // removed store.chapters.length - chapters read from getState()

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
