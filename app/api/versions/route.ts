import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/versions?projectId=xxx&type=outline
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const type = searchParams.get('type');

    if (!projectId) {
      return NextResponse.json({ error: '缺少 projectId' }, { status: 400 });
    }

    const snapshots = await db.getVersionSnapshots(projectId, type || undefined);
    return NextResponse.json(snapshots);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '操作失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/versions  创建快照（同 key 5分钟内限频，避免自动保存产生过多快照）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, type, key, label, data, source } = body;

    if (!projectId || !type || !key || !label || !data) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 自动保存快照限频：同 projectId+key 在5分钟内不重复创建
    if (source === 'auto') {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recent = await db.findRecentVersionSnapshot(projectId, key, 'auto', fiveMinAgo);
      if (recent) {
        return NextResponse.json({ skipped: true, reason: 'rate_limited' });
      }
    }

    const snapshot = await db.createVersionSnapshot({
      projectId,
      type,
      key,
      label,
      data: typeof data === 'string' ? data : JSON.stringify(data),
      source: source || 'auto',
    });

    return NextResponse.json(snapshot);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '操作失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/versions?id=xxx  删除快照
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    await db.deleteVersionSnapshot(id);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '操作失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
