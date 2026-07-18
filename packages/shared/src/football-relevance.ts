/**
 * Football-relevance gate for Iranian newsroom.
 * Prefer title (+ short lead) — full HTML often contains sidebar "فوتبال" widgets
 * that falsely mark political pages as football.
 */

const FOOTBALL_POSITIVE =
  /فوتبال|فوتبالیست|باشگاه\s*فوتبال|لیگ\s*برتر|لیگ\s*قهرمانان|جام\s*حذفی|تیم\s*ملی\s*فوتبال|استقلال|پرسپولیس|سپاهان|تراکتور|فولاد|نساجی|گل\s*گهر|مس\s*رفسنجان|پیکان|ذوب[\s‌-]*آهن|فدراسیون\s*فوتبال|نقل\s*و\s*انتقال|سرمربی|دروازه‌?بان|هافبک|مهاجم|مدافع|آفساید|پنالتی|کرت\s*زرد|کرت\s*قرمز|ورزشگاه|football|soccer|premier\s*league|la\s*liga|serie\s*a|bundesliga|ligue\s*1|champions\s*league|europa\s*league|world\s*cup|fifa|uefa|mls|transfer\s*window|midfielder|striker|goalkeeper|manchester\s*united|manchester\s*city|liverpool|chelsea|arsenal|tottenham|real\s*madrid|barcelona|bayern|juventus|psg|inter\s*milan|ac\s*milan|ronaldo|messi|mbappe|haaland|lewandowski|نیمار|مسی|رونالدو|هالان|امباپه/i;

const OTHER_SPORT =
  /بسکتبال|والیبال|کشتی|وزنه[\s‌-]*برداری|تکواندو|جودو|ووشو|شنا\b|شیرجه|دوچرخه[\s‌-]*سواری|اتومبیل[\s‌-]*رانی|فرمول\s*یک|تنیس(?!\s*فوتبال)|بدمینتون|هندبال|هاکی|اسکی|شمشیربازی|بوکس|مـ?Mixed\s*Martial|mma\b|rugby|cricket|baseball|nba|nhl|ufc|volleyball|basketball|wrestling|weightlifting|taekwondo|handball|formula\s*1/i;

const POLITICS_HARD =
  /تنگه\s*هرمز|جبهه\s*مقاومت|رهبر|انقلاب|مجلس\s*شورای|وزیر\s*خارجه|سیاست\s*خارجی|تحریم|مذاکرات\s*هسته‌ای|سپاه\s*پاسداران|نیروی\s*انتظامی|انتخابات\s*مجلس|قوه\s*قضائیه|دیپلماسی|کاخ\s*سفید|پنتاگون|ناتو\b|حماس|حزب[\s‌-]*الله|غزه(?!.*فوتبال)|فلسطین(?!.*فوتبال)|جنگ\s*اوکراین|رئیس\s*جمهور\s*آمریکا/i;

export type FootballRelevance = {
  isFootball: boolean;
  reasons: string[];
  /** 0–100 confidence used for logging / soft ranking */
  confidence: number;
};

export function assessFootballRelevance(input: {
  title?: string | null;
  summary?: string | null;
  /** Prefer short lead — do not pass full scraped HTML */
  leadText?: string | null;
}): FootballRelevance {
  const title = (input.title ?? '').trim();
  const summary = (input.summary ?? '').trim();
  const lead = (input.leadText ?? '').trim().slice(0, 600);
  const primary = `${title}\n${summary}`.trim();
  const corpus = `${primary}\n${lead}`.trim();
  const reasons: string[] = [];

  if (!primary && !lead) {
    return { isFootball: false, reasons: ['empty_text'], confidence: 0 };
  }

  const titleHasFootball = FOOTBALL_POSITIVE.test(title);
  const primaryHasFootball = FOOTBALL_POSITIVE.test(primary);
  const corpusHasFootball = FOOTBALL_POSITIVE.test(corpus);

  if (POLITICS_HARD.test(primary) && !titleHasFootball) {
    reasons.push('politics_without_football_title');
    return { isFootball: false, reasons, confidence: 5 };
  }

  if (OTHER_SPORT.test(title) && !titleHasFootball) {
    reasons.push('other_sport_title');
    return { isFootball: false, reasons, confidence: 8 };
  }

  if (OTHER_SPORT.test(primary) && !primaryHasFootball) {
    reasons.push('other_sport_body');
    return { isFootball: false, reasons, confidence: 10 };
  }

  if (titleHasFootball) {
    reasons.push('football_in_title');
    return { isFootball: true, reasons, confidence: 92 };
  }

  if (primaryHasFootball) {
    reasons.push('football_in_title_or_summary');
    return { isFootball: true, reasons, confidence: 78 };
  }

  // Lead-only match is weak (nav widgets) — reject unless strong club/league tokens
  if (corpusHasFootball && !primaryHasFootball) {
    reasons.push('football_only_in_lead_likely_widget');
    return { isFootball: false, reasons, confidence: 20 };
  }

  reasons.push('no_football_signal');
  return { isFootball: false, reasons, confidence: 12 };
}
