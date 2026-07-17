export interface RssEpisodeItem {
  title: string;
  description: string;
  audioUrl: string;
  durationSec: number;
  pubDate: Date;
  guid: string;
  mimeType?: string;
  fileSizeBytes?: number;
}

export function buildPodcastRss(input: {
  channelTitle: string;
  channelDescription: string;
  channelLink: string;
  language?: string;
  items: RssEpisodeItem[];
}): string {
  const lang = input.language ?? 'fa-IR';
  const itemsXml = input.items
    .map((item) => {
      const enclosure = item.fileSizeBytes
        ? `<enclosure url="${escapeXml(item.audioUrl)}" length="${item.fileSizeBytes}" type="${item.mimeType ?? 'audio/wav'}" />`
        : `<enclosure url="${escapeXml(item.audioUrl)}" type="${item.mimeType ?? 'audio/wav'}" />`;
      return `    <item>
      <title>${escapeXml(item.title)}</title>
      <description>${escapeXml(item.description)}</description>
      <guid isPermaLink="false">${escapeXml(item.guid)}</guid>
      <pubDate>${item.pubDate.toUTCString()}</pubDate>
      ${enclosure}
      <itunes:duration>${formatItunesDuration(item.durationSec)}</itunes:duration>
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>${escapeXml(input.channelTitle)}</title>
    <link>${escapeXml(input.channelLink)}</link>
    <description>${escapeXml(input.channelDescription)}</description>
    <language>${lang}</language>
${itemsXml}
  </channel>
</rss>
`;
}

function formatItunesDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
