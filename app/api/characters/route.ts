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

    const characters = await db.getCharacters(projectId);
    return NextResponse.json(characters, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '获取角色列表失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, name, role, age, identity, personality, goals, relationships, currentState, forbidden } = body;

    if (!projectId) {
      return NextResponse.json({ error: '缺少 projectId' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: '角色名称不能为空' }, { status: 400 });
    }

    const newChar = await db.createCharacter({
      projectId,
      name,
      role: role || '配角',
      age: age || '',
      identity: identity || '',
      personality: personality || [],
      goals: goals || [],
      relationships: relationships || [],
      currentState: currentState || '',
      forbidden: forbidden || [],
    });

    return NextResponse.json(newChar, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '创建角色失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
