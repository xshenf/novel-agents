import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: '缺少 projectId 参数' }, { status: 400 });
    }

    const states = await db.getWorldStates(projectId);
    return NextResponse.json(states, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '获取世界状态失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, category, name, content, pinned, source, updatedAtChapter } = body;

    if (!projectId) {
      return NextResponse.json({ error: '缺少 projectId' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: '名称不能为空' }, { status: 400 });
    }

    const newState = await db.createWorldState({
      projectId,
      category: category || '其他',
      name,
      content: content || '',
      pinned: pinned ?? false,
      source: source || 'manual',
      updatedAtChapter: updatedAtChapter || '',
    });

    return NextResponse.json(newState, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '创建世界状态失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
