import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const projects = db.getProjects();
    return NextResponse.json(projects);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '获取项目失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, styleSetting, worldSetting } = body;
    
    if (!title) {
      return NextResponse.json({ error: '项目标题不能为空' }, { status: 400 });
    }

    const newProject = db.createProject({
      title,
      description: description || '',
      styleSetting: styleSetting || '',
      worldSetting: worldSetting || '',
    });

    return NextResponse.json(newProject, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '创建项目失败' }, { status: 500 });
  }
}
