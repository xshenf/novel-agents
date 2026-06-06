// 大纲树状结构解析与序列化工具
// 负责分卷（一级 #）/章节（二级 ##）/卡片键值对的解析、序列化、重新编号与统计

export interface OutlineChapter {
  title: string;
  content: string;
  details: { key: string; value: string }[];
  isLocked?: boolean;
}

export interface OutlineVolume {
  title: string;
  content: string;
  chapters: OutlineChapter[];
  isLocked?: boolean;
}

const LOCK_MARKERS = ['<!-- LOCKED -->', '[LOCKED]'];

function stripLockMarkers(text: string): { text: string; isLocked: boolean } {
  let isLocked = false;
  let cleaned = text;
  for (const marker of LOCK_MARKERS) {
    if (cleaned.includes(marker)) {
      isLocked = true;
      cleaned = cleaned.split(marker).join('');
    }
  }
  return { text: cleaned.trim(), isLocked };
}

// 智能大纲解析器，提取分卷（一级标题 # ）与章节（二级标题 ## ）和锁定状态标记
export function parseStructureOutline(text: string): OutlineVolume[] {
  if (!text) return [];
  const volumes: OutlineVolume[] = [];
  let currentVolume: OutlineVolume | null = null;
  let currentChapter: OutlineChapter | null = null;

  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^#[^#]/.test(trimmed)) {
      const rawTitle = trimmed.replace(/^#\s+/, '').trim();
      const { text: titleText, isLocked } = stripLockMarkers(rawTitle);
      currentVolume = {
        title: titleText || '新分卷',
        content: '',
        chapters: [],
        isLocked
      };
      volumes.push(currentVolume);
      currentChapter = null;
    } else if (trimmed.startsWith('##')) {
      const rawTitle = trimmed.replace(/^##\s+/, '').trim();
      const { text: titleText, isLocked } = stripLockMarkers(rawTitle);
      currentChapter = {
        title: titleText || '新章节',
        content: '',
        details: [],
        isLocked
      };

      // 如果大纲一上来就是章节标题，隐式为其创建一个默认正文卷
      if (!currentVolume) {
        currentVolume = {
          title: '第一卷：正文',
          content: '全局默认分卷',
          chapters: []
        };
        volumes.push(currentVolume);
      }
      currentVolume.chapters.push(currentChapter);
    } else {
      if (currentChapter) {
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          // 匹配卡片键值对，例如: "- **核心冲突**：xxx"
          const kvMatch = trimmed.match(/^[\-\*]\s+(?:\*\*(.*?)\*\*|([^：:]+))[：:](.*)$/);
          if (kvMatch) {
            const key = (kvMatch[1] || kvMatch[2]).trim();
            const value = kvMatch[3].trim();
            currentChapter.details.push({ key, value });
          } else {
            currentChapter.content += (currentChapter.content ? '\n' : '') + trimmed.replace(/^[\-\*]\s+/, '');
          }
        } else {
          currentChapter.content += (currentChapter.content ? '\n' : '') + trimmed;
        }
      } else if (currentVolume) {
        currentVolume.content += (currentVolume.content ? '\n' : '') + trimmed;
      }
    }
  }

  // 兜底保障：如果没有解析到任何分卷，尝试隐式补充一个正文卷
  if (volumes.length === 0) {
    volumes.push({
      title: '第一卷：正文',
      content: '全局默认分卷',
      chapters: []
    });
  }

  return volumes;
}

// 将树状的分卷-章节结构重新序列化编译成规整的 Markdown 文本，并携带锁定标记
export function generateMarkdownFromSections(volumes: OutlineVolume[]): string {
  return volumes.map(vol => {
    let part = `# ${vol.title}${vol.isLocked ? ' <!-- LOCKED -->' : ''}\n`;
    if (vol.content && vol.content.trim()) {
      part += `${vol.content.trim()}\n`;
    }
    vol.chapters.forEach(sec => {
      part += `\n## ${sec.title}${sec.isLocked ? ' <!-- LOCKED -->' : ''}\n`;
      if (sec.content && sec.content.trim()) {
        part += `${sec.content.trim()}\n`;
      }
      sec.details.forEach(det => {
        if (det.key.trim() && det.value.trim()) {
          part += `- **${det.key.trim()}**：${det.value.trim()}\n`;
        }
      });
    });
    return part;
  }).join('\n\n');
}

// 将数字转换为中文章节/卷序号
function getChineseNumber(num: number): string {
  const chineseNumbers = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
  if (num <= 20) return chineseNumbers[num];
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const units = num % 10;
    if (units === 0) return `${chineseNumbers[tens]}十`;
    return `${chineseNumbers[tens]}十${chineseNumbers[units]}`;
  }
  return String(num);
}

// 自动对卷名和章节标题做多级层级化自动重排
export function renumberVolumesAndChapters(volumes: OutlineVolume[]): OutlineVolume[] {
  let volIdx = 1;
  let chapIdx = 1;

  return volumes.map((vol, vIdx) => {
    const currentVolTitle = vol.title;
    const volMatch = currentVolTitle.match(/^(?:第[一二三四五六七八九十百\d]+卷[：:\s\-]*)(.*)$/);
    const remainingVolTitle = volMatch ? volMatch[1].trim() : currentVolTitle;

    // 过滤导言类非正文卷
    const isIntro = vIdx === 0 && (remainingVolTitle.includes('导言') || remainingVolTitle.includes('前言') || remainingVolTitle.includes('简介') || remainingVolTitle === '正文');
    const volTitle = isIntro ? remainingVolTitle : `第${getChineseNumber(volIdx)}卷：${remainingVolTitle || '新分卷'}`;
    if (!isIntro) volIdx++;

    const newChapters = vol.chapters.map((sec) => {
      const currentTitle = sec.title;
      const titleMatch = currentTitle.match(/^(?:第[一二三四五六七八九十百\d]+章[：:\s\-]*)(.*)$/);
      const remainingTitle = titleMatch ? titleMatch[1].trim() : currentTitle;

      const chapNum = getChineseNumber(chapIdx);
      chapIdx++;
      return {
        ...sec,
        title: `第${chapNum}章：${remainingTitle || '新章节'}`
      };
    });

    return {
      ...vol,
      title: volTitle,
      chapters: newChapters
    };
  });
}

// 提取章节包含的登场角色列表
export function parseCharacters(details: { key: string; value: string }[]): string[] {
  const charDetail = details.find(d => d.key.includes('人物') || d.key.includes('角色'));
  if (!charDetail) return [];
  return charDetail.value
    .split(/[,，、\/\\\s\+]+/)
    .map(c => c.trim())
    .filter(c => c.length > 0 && c !== '主角' && c !== '配角');
}

// 定量化章节情绪曲线值
export function parseEmotionValue(details: { key: string; value: string }[]): number {
  const emoDetail = details.find(d => d.key.includes('情绪') || d.key.includes('起伏') || d.key.includes('曲线'));
  if (!emoDetail) return 50;
  const val = emoDetail.value;
  const match = val.match(/(\d+)%/);
  if (match) return parseInt(match[1], 10);

  if (val.includes('高潮') || val.includes('爽') || val.includes('燃') || val.includes('沸腾') || val.includes('爆发')) return 90;
  if (val.includes('逆袭') || val.includes('打脸') || val.includes('反击') || val.includes('爽快')) return 80;
  if (val.includes('冲突') || val.includes('危机') || val.includes('交锋') || val.includes('博弈')) return 70;
  if (val.includes('铺垫') || val.includes('悬念') || val.includes('伏笔')) return 60;
  if (val.includes('日常') || val.includes('平稳') || val.includes('轻松') || val.includes('温馨')) return 50;
  if (val.includes('压抑') || val.includes('绝境') || val.includes('低谷') || val.includes('困难')) return 25;
  return 50;
}

// 从章节 details 卡片中按关键字查找字段值，未命中返回 null
export function findDetail(details: { key: string; value: string }[], includes: string[]): string | null {
  const hit = details.find(d => includes.some(kw => d.key.includes(kw)));
  return hit ? hit.value.trim() : null;
}
