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

    const rules = await db.getWorldRules(projectId);
    return NextResponse.json(rules, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '获取设定失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, name, type, description } = body;

    if (!projectId) {
      return NextResponse.json({ error: '缺少 projectId' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: '名称不能为空' }, { status: 400 });
    }

    const newRule = await db.createWorldRule({
      projectId,
      name,
      type: type || 'other',
      description: description || '',
    });

    return NextResponse.json(newRule, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '创建设定失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
