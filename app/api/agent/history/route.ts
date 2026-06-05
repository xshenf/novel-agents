import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: '缺少 projectId 参数' }, { status: 400 });
    }

    const messages = await db.getAgentMessages(projectId);
    return NextResponse.json(messages);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '获取历史对话失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, messages } = body;

    if (!projectId) {
      return NextResponse.json({ error: '缺少 projectId 参数' }, { status: 400 });
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: '无效的 messages 参数' }, { status: 400 });
    }

    const saved = await db.saveAgentMessages(projectId, messages);
    return NextResponse.json(saved);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '保存历史对话失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: '缺少 projectId 参数' }, { status: 400 });
    }

    await db.clearAgentMessages(projectId);
    return NextResponse.json({ success: true, message: '历史对话已清空' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '清空历史对话失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
