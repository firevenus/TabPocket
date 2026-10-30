// ============================================================
// 标签显示名：存储里用的是中文标签值（历史数据不能改），展示时按语言翻译
// ============================================================
import { getLang, t } from './core';

/** 与 bookmarks.ts 的 TAG_READ_LATER / 整理时的「常用」保持一致 */
const TAG_READ_LATER = '待看';
const TAG_FREQUENT = '常用';

const CATEGORY_EN: Record<string, string> = {
  开发: 'Dev',
  金融财经: 'Finance',
  视频: 'Video',
  社交社区: 'Social',
  购物电商: 'Shopping',
  新闻资讯: 'News',
  搜索工具: 'Tools',
  邮箱办公: 'Office',
  游戏: 'Gaming',
  学习教育: 'Learning',
  音乐: 'Music',
  阅读写作: 'Writing',
  旅行生活: 'Travel',
  其他: 'Other',
};

/** 把存储里的标签值转成当前语言的显示文本 */
export function displayTag(tag: string): string {
  if (tag === TAG_READ_LATER) return t('tag.readLater');
  if (tag === TAG_FREQUENT) return t('tag.frequent');
  if (getLang() === 'zh') return tag;
  return CATEGORY_EN[tag] ?? tag;
}
