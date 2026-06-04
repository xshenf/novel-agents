import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: '缺少 projectId 参数' }, { status: 400 });
    }

    const rules = db.getWorldRules(projectId);
    return NextResponse.json(rules);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '获取设定失败' }, { status: 500 });
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

    const newRule = db.createWorldRule({
      projectId,
      name,
      type: type || 'other',
      description: description || '',
    });

    return NextResponse.json(newRule, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '创建设定失败' }, { status: 500 });
  }
}
