import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: '缺少 projectId 参数' }, { status: 400 });
    }

    const characters = db.getCharacters(projectId);
    return NextResponse.json(characters);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '获取角色列表失败' }, { status: 500 });
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

    const newChar = db.createCharacter({
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '创建角色失败' }, { status: 500 });
  }
}
