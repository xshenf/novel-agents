import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const projects = await db.getProjectList();
    return NextResponse.json(projects);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '获取项目失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, styleSetting, worldSetting, forbiddenSetting } = body;
    
    if (!title) {
      return NextResponse.json({ error: '项目标题不能为空' }, { status: 400 });
    }

    const newProject = await db.createProject({
      title,
      description: description || '',
      styleSetting: styleSetting || '',
      worldSetting: worldSetting || '',
      forbiddenSetting: forbiddenSetting || '',
      powerSystem: '',
      goldFinger: '',
      coreConflict: '',
      factionsMap: '',
      sellingPoints: '',
      outlineFull: '',
      antiAiStyleRules: [],
    });

    return NextResponse.json(newProject, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '创建项目失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
