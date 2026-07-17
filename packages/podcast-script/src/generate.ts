import type { GeneratedScript, ScriptClaim, ScriptNewsItem } from './types.js';

/** Rough Persian narration pace used for 8–12 minute targeting. */
export const WORDS_PER_MINUTE = 145;
export const TARGET_MIN_MINUTES = 8;
export const TARGET_MAX_MINUTES = 12;

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function estimateDurationSec(wordCount: number): number {
  return Math.round((wordCount / WORDS_PER_MINUTE) * 60);
}

function expandSummary(item: ScriptNewsItem, index: number): string {
  const summary =
    item.summary?.trim() ||
    'جزئیات بیشتری از منابع معتبر در دسترس نیست و باید با احتیاط روایت شود.';
  const scopeLabel =
    item.scope === 'iran' ? 'فوتبال ایران' : item.scope === 'europe' ? 'فوتبال اروپا' : 'اخبار فوتبال';
  const official =
    item.officialStatus === 'OFFICIAL' || item.officialStatus === 'CONFIRMED'
      ? 'این خبر جنبه رسمی‌تری دارد.'
      : 'هنوز نباید آن را قطعی اعلام کرد.';
  const bridge =
    index === 0
      ? 'برای شروع سراغ مهم‌ترین خبر می‌رویم.'
      : 'و اما خبر بعدی که ارزش توقف دارد.';

  return [
    bridge,
    `در حوزه ${scopeLabel}، تیتر این است: ${item.title}.`,
    summary,
    official,
    item.sourceLabels?.length
      ? `منبع روایت ما: ${item.sourceLabels.join('، ')}.`
      : 'منبع این بخش در کارت خبر ثبت شده است.',
    'این را کوتاه نگه می‌داریم و فقط روی نکته اصلی تمرکز می‌کنیم.',
  ].join(' ');
}

/**
 * Mock script builder — deterministic, no external AI.
 * Pads/trims narration toward an 8–12 minute spoken length.
 */
export function generatePodcastScript(input: {
  episodeTitle: string;
  items: ScriptNewsItem[];
  targetMinutes?: number;
}): GeneratedScript {
  const targetMinutes = Math.min(
    TARGET_MAX_MINUTES,
    Math.max(TARGET_MIN_MINUTES, input.targetMinutes ?? 10),
  );
  const targetWords = Math.round(targetMinutes * WORDS_PER_MINUTE);
  const items = [...input.items].sort(
    (a, b) => (b.importanceScore ?? 0) - (a.importanceScore ?? 0),
  );

  if (items.length === 0) {
    const bodyMd = [
      `# ${input.episodeTitle}`,
      '',
      'سلام؛ به اپیزود خبری فوتبال خوش آمدید.',
      'در این نسخه هنوز خبری برای روایت انتخاب نشده است.',
      'به محض تأیید اخبار در صندوق ورودی، اسکریپت کامل ساخته می‌شود.',
    ].join('\n');
    return {
      title: input.episodeTitle,
      bodyMd,
      wordCount: countWords(bodyMd),
      estimatedDurationSec: estimateDurationSec(countWords(bodyMd)),
      claims: [],
      segments: [],
      generator: 'mock-v1',
    };
  }

  const intro = [
    `# ${input.episodeTitle}`,
    '',
    '## مقدمه',
    'سلام؛ به خلاصه خبرهای فوتبال خوش آمدید.',
    'در هشت تا دوازده دقیقه پیش رو، فقط خبرهایی را می‌خوانیم که از فیلتر سردبیری رد شده‌اند.',
    'هر ادعا را به منبعش وصل می‌کنیم و شایعه تک‌منبعی را قطعی جا نمی‌زنیم.',
    '',
  ];

  const segments: GeneratedScript['segments'] = [];
  const claims: ScriptClaim[] = [];
  const bodyParts: string[] = [...intro];

  items.forEach((item, index) => {
    const heading = `خبر ${index + 1}`;
    const narration = expandSummary(item, index);
    const block = [`## ${heading}`, narration, ''].join('\n');
    bodyParts.push(block);
    segments.push({
      heading,
      eventId: item.eventId,
      wordCount: countWords(narration),
    });
    claims.push({
      claim: item.title,
      eventId: item.eventId,
      sourceLabel: item.sourceLabels?.[0] ?? 'news_event',
      confidence: item.officialStatus === 'OFFICIAL' ? 0.9 : 0.65,
      status:
        item.officialStatus === 'OFFICIAL' || item.officialStatus === 'CONFIRMED'
          ? 'supported'
          : 'unverified',
    });
  });

  let bodyMd = bodyParts.join('\n');
  let words = countWords(bodyMd);

  // Pad toward target with a closing rundown (still grounded in selected items).
  if (words < targetWords) {
    const rundown = items
      .map(
        (item, i) =>
          `${i + 1}. ${item.title}${item.sourceLabels?.[0] ? ` — منبع: ${item.sourceLabels[0]}` : ''}`,
      )
      .join('\n');
    const fillerBlocks: string[] = [
      '## مرور نهایی',
      'قبل از خداحافظی یک مرور سریع می‌کنیم تا خط خبرها گم نشود:',
      rundown,
      '',
      'اگر تحول تازه‌ای به این داستان‌ها اضافه شود، در اپیزود بعدی جداگانه پوشش می‌دهیم.',
    ];
    while (words < targetWords && fillerBlocks.length) {
      bodyMd += `\n${fillerBlocks.shift()}\n`;
      words = countWords(bodyMd);
    }
    while (words < targetWords) {
      bodyMd +=
        '\nیادآوری سردبیری: روایت را کوتاه، شفاف و وابسته به منبع نگه می‌داریم؛ جزئیات تأییدنشده را بزرگ‌نمایی نمی‌کنیم.\n';
      words = countWords(bodyMd);
    }
  }

  const outro = [
    '',
    '## پایان',
    'ممنون که همراه بودید.',
    'این اپیزود بر اساس کارت‌های تأییدشده اتاق خبر ساخته شده و برای تولید صوت آماده است.',
  ].join('\n');
  bodyMd += outro;
  words = countWords(bodyMd);

  return {
    title: input.episodeTitle,
    bodyMd,
    wordCount: words,
    estimatedDurationSec: estimateDurationSec(words),
    claims,
    segments,
    generator: 'mock-v1',
  };
}
