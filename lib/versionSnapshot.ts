/**
 * 创建版本快照的通用工具函数
 * 在自动保存时调用，记录内容变更历史
 */

interface CreateSnapshotParams {
  projectId: string;
  type: 'outline' | 'macro' | 'chapter' | 'character' | 'worldRule';
  key: string;
  label: string;
  data: any;
  source?: 'manual' | 'auto' | 'ai';
}

export async function createVersionSnapshot(params: CreateSnapshotParams): Promise<{ id: string } | null> {
  try {
    const res = await fetch('/api/versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        data: typeof params.data === 'string' ? params.data : JSON.stringify(params.data),
        source: params.source || 'auto',
      }),
    });
    if (res.ok) {
      const body = await res.json();
      return { id: body.id ?? '' };
    }
    return null;
  } catch {
    // 快照创建失败不应阻塞主流程
    return null;
  }
}
