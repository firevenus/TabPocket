// ============================================================
// 域名自动分类（整理收藏用）：hostname 关键词 → 分类标签
// ============================================================

const RULES: { category: string; keywords: string[] }[] = [
  {
    category: '开发',
    keywords: [
      'github', 'gitlab', 'gitee', 'stackoverflow', 'stackexchange', 'npm',
      'mdn', 'developer', 'docs', 'dev.', 'juejin', 'csdn', 'segmentfault',
      'vercel', 'cloudflare', 'netlify', 'docker', 'kubernetes', 'w3school',
      'runoob', 'infoq', 'leetcode', 'codesandbox', 'stackblitz', 'vitejs',
      'typescriptlang', 'react.dev', 'vuejs', 'python.org', 'nodejs',
    ],
  },
  {
    category: '金融财经',
    keywords: [
      'xueqiu', 'eastmoney', '10jqka', 'finance.sina', 'wallstreetcn',
      'investing.com', 'bloomberg', 'reuters', 'fund.eastmoney', 'jrj.com',
      'cnstock', 'stcn', 'yicai', 'caixin', 'hexun', 'sinafinance', 'wj.com',
      'jin10', 'futunn', 'tigerbrokers', 'binance', 'coinbase', 'okx',
      'bybit', 'coingecko', 'coindesk', 'cointelegraph', 'panewslab',
      'theblock', 'gmgn', 'aicoin',
    ],
  },
  {
    category: '视频',
    keywords: [
      'youtube', 'bilibili', 'youku', 'iqiyi', 'v.qq', 'douyin', 'tiktok',
      'kuaishou', 'mgtv', 'sohu.com', 'acfun', 'huya', 'douyu',
    ],
  },
  {
    category: '社交社区',
    keywords: [
      'weibo', 'weixin', 'wechat', 'qq.com', 'zhihu', 'reddit', 'x.com',
      'twitter', 'facebook', 'instagram', 'discord', 'telegram', 'v2ex',
      'xiaohongshu', 'douban', 'threads', 'linkedin', 'tieba',
    ],
  },
  {
    category: '购物电商',
    keywords: [
      'taobao', 'tmall', 'jd.com', 'pinduoduo', 'suning', 'amazon', 'ebay',
      '1688', 'dangdang', 'kaola', 'vip.com', 'xiaomi', 'huawei', 'gome',
      'yihaodian', 'meituan', 'dianping', 'ele.me', 'taopiaopiao',
    ],
  },
  {
    category: '新闻资讯',
    keywords: [
      'news', 'sina', 'sohu', '163.com', 'ifeng', 'thepaper', '36kr',
      'huxiu', 'ithome', 'sspai', 'medium.com', 'techcrunch', 'theverge',
      'cnbeta', 'solidot', 'chinaso', 'people.com', 'xinhuanet', 'cctv',
      'gmw.cn', 'chinanews',
    ],
  },
  {
    category: '搜索工具',
    keywords: [
      'baidu', 'google', 'bing', 'sogou', 'sm.cn', 'duckduckgo', 'yandex',
      'wikipedia', 'translate', 'dict.', 'youdao', 'iciba', 'convert',
      'calculator', 'tool', 'tampermonkey', 'greasyfork', 'github.io',
      'chrome.google.com', 'microsoftedge', 'mozilla',
    ],
  },
  {
    category: '邮箱办公',
    keywords: [
      'mail', 'gmail', 'outlook', 'office', 'wps', 'notion', 'feishu',
      'larksuite', 'slack', 'microsoft', 'apple.com', 'icloud', 'todoist',
      'trello', 'asana', 'quip', 'kancloud', 'youdao', 'dingtalk',
    ],
  },
  {
    category: '游戏',
    keywords: [
      'steam', 'epicgames', 'gog.com', 'taptap', '4399', 'itch.io',
      'indienova', 'gamemaker', 'unity', 'unrealengine', 'godotengine',
      'itch', 'armorgames', 'kongregate',
    ],
  },
  {
    category: '学习教育',
    keywords: [
      'coursera', 'udemy', 'khanacademy', 'mooc', 'icourse163', 'edx',
      'duolingo', 'w3cschool', 'codecademy', 'geeksforgeeks', 'freecodecamp',
      'baike', 'wenku', 'doc.', 'wikipedia', 'quora',
    ],
  },
  {
    category: '音乐',
    keywords: [
      'spotify', 'music.163', 'y.qq.com', 'kugou', 'xiami', 'soundcloud',
      'kuwo', 'migu',
    ],
  },
  {
    category: '阅读写作',
    keywords: [
      'jianshu', 'medium', 'zhihu', 'blog', 'wordpress', 'ghost.org',
      'notion', 'evernote', 'youzhi', 'wallstreetcn', 'sspai',
    ],
  },
  {
    category: '旅行生活',
    keywords: [
      'ctrip', 'qunar', 'tuniu', 'ly.com', 'fliggy', '12306', 'airbnb',
      'booking.com', 'meituan', 'dianping', 'ele.me',
    ],
  },
];

const DEFAULT_CATEGORY = '其他';

/** 根据 URL 判断分类标签 */
export function classifyDomain(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return DEFAULT_CATEGORY;
  }
  // 去掉常见前缀，便于关键词匹配
  const bare = host.replace(/^(www\.|m\.|mobile\.|mp\.)/, '');
  for (const rule of RULES) {
    if (rule.keywords.some((k) => bare.includes(k.toLowerCase()))) {
      return rule.category;
    }
  }
  return DEFAULT_CATEGORY;
}

/** 判断域名是否为常用（访问频率 TopN 列表内） */
export function isFrequentDomain(url: string, frequentDomains: Set<string>): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return frequentDomains.has(host);
  } catch {
    return false;
  }
}
