# خط لوله هوش مصنوعی — Football Newsroom

## اصول هزینه و کیفیت

1. مدل گران برای خواندن همه منابع استفاده نشود.
2. Opus/سطح بالا فقط کارت‌های خلاصه‌شده و تأییدشده را ببیند.
3. خروجی همیشه با JSON Schema اعتبارسنجی شود.
4. هر درخواست: provider، model، tokens، cost، latency، promptVersion ذخیره شود.
5. Mock Provider برای تست بدون هزینه اجباری است.

## مراحل و مدل‌های پیشنهادی

| مرحله | مدل پیشنهادی (ارزان → گران) | ورودی | خروجی |
|-------|------------------------------|--------|--------|
| Article Extraction | Haiku / GPT Mini / Gemini Flash / DeepSeek / ارزان OpenRouter | متن نرمال‌شده مقاله | کارت JSON |
| Event Merge & Analysis | Sonnet / GPT mid / Gemini Pro | چند کارت + metadata | رویداد، تناقض، اهمیت پیشنهادی |
| Editorial / Podcast Script | Opus / GPT high / Gemini advanced | کارت‌های منتخب + قوانین + لحن + واژه‌نامه | اسکریپت گفتاری |
| Fact Check | mid-tier | اسکریپت + claims | لیست مغایرت |
| Translation | mid/cheap | متن | ترجمه (فاز بعدی) |
| TTS | Provider جدا | اسکریپت نهایی | audio file |

## Providerهای پشتیبانی‌شده (Abstraction)

Anthropic, OpenAI, Google, DeepSeek, Z.ai, OpenRouter, Local Model, Custom OpenAI-Compatible API

رابط مشترک در `packages/ai`:

```typescript
interface AiCompletionRequest {
  pipelineStage: string;
  promptVersionId: string;
  systemPrompt: string;
  userPrompt: string;
  jsonSchema?: object;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, string>;
}

interface AiCompletionResult {
  content: string;
  parsed?: unknown;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
    reasoningTokens?: number;
  };
  latencyMs: number;
  provider: string;
  model: string;
}
```

## کارت استاندارد مقاله

```json
{
  "articleId": "uuid",
  "isRelevant": true,
  "scope": "iran",
  "category": "transfer",
  "headlineFa": "string",
  "summaryFa": "string",
  "league": { "id": "string", "name": "string" },
  "clubs": [{ "id": "string", "name": "string" }],
  "people": [{ "id": "string", "name": "string", "role": "player" }],
  "facts": [
    {
      "claim": "string",
      "status": "verified",
      "confidence": 0.95,
      "sourceText": "string"
    }
  ],
  "numbers": [
    {
      "label": "transfer_fee",
      "value": 50000000,
      "currency": "EUR",
      "isConfirmed": false
    }
  ],
  "quotes": [],
  "officialStatus": "reliable_report",
  "sourceType": "trusted_media",
  "importanceScore": 82,
  "credibilityScore": 88,
  "freshnessScore": 95,
  "nationalRelevanceScore": 20,
  "duplicateProbability": 0.12,
  "publishedAt": "ISO_DATE",
  "eventOccurredAt": "ISO_DATE",
  "sourceName": "string",
  "sourceUrl": "string",
  "uncertainties": [],
  "rejectionReasons": []
}
```

## نسخه‌بندی Prompt

هر PromptVersion:

- Name, Pipeline Stage, Provider, Model, Version
- System Prompt, User Prompt Template, JSON Schema
- Temperature, Max Tokens, Effort
- Is Active, Created By, Created At

هر AIRequest باید `promptVersionId` داشته باشد.

## تولید پادکست — ورودی مدل سردبیر

- قوانین ثابت تحریریه
- لحن برنامه
- مدت هدف
- خبرهای منتخب + منبع + وضعیت اعتبار
- نتایج/آمار ساختاریافته
- محدودیت زمانی
- واژه‌نامه و تلفظ
- متن اپیزود قبلی (ضد تکرار)

### ساختار پیش‌فرض برنامه (قابل تنظیم)

1. شروع کوتاه  
2. تیتر مهم روز  
3. فوتبال ایران  
4. فوتبال اروپا  
5. نقل‌وانتقالات  
6. نتایج مهم  
7. خبر کوتاه  
8. پایان‌بندی  

### کیفیت متن نهایی

گفتاری، غیرتیترخوان، ۸–۱۲ دقیقه، بدون تکرار، بدون ادعای بی‌منبع، عدم قطعی‌کردن شایعه، حفظ تفاوت رسمی/رسانه، اعداد/نام دقیق، جملات مناسب TTS.

## مدیریت هزینه

ذخیره per request: provider, model, input/cached/output/reasoning tokens, search calls, estimated/actual cost, latency, status, error, related article/event/episode.

داشبورد: امروز، ماه، per episode/source/model/stage، میانگین extract و podcast.

## Clustering AI Boundary (PR-B)

- Interface: `ClusterAiJudge` در `@footcast/event-clustering`
- Adapter واقعی: `HttpClusterAiJudge` (OpenAI-compatible JSON)
- Feature flag: `CLUSTER_AI_JUDGE_ENABLED` (پیش‌فرض `false`)
- فقط در بازه similarity مرزی + entity/category gate؛ exact/near قطعی از AI رد نمی‌شوند
- خروجی با `validateAiBoundaryResult`؛ failure یا confidence `< 0.80` → Create / Needs Review
- Embedding: `EMBEDDING_PROVIDER=mock|openai`؛ mock در production با `EMBEDDING_ALLOW_MOCK=false` fail-fast

جزئیات ارزیابی: `CLUSTERING_EVALUATION.md`.

## محدودیت‌ها

- نتایج مسابقه از API رسمی — نه LLM به‌عنوان حقیقت
- عدم hallucination خارج از ورودی
- Job قابل retry پس از شکست Provider
