"""بارگذاری تنظیمات از config/sources.yaml و متغیرهای محیطی."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG_PATH = ROOT / "config" / "sources.yaml"
DEFAULT_OUTPUT_DIR = ROOT / "output"


def _clean_key(val: str | None) -> str | None:
    """کلید نامعتبر/placeholder را None برمی‌گرداند تا مسیر بدون‌کلید فعال شود."""
    if not val:
        return None
    val = val.strip()
    # مقادیر نمونه‌ی .env.example را واقعی حساب نکن
    if not val or "..." in val or val in ("sk-ant-", "sk_..."):
        return None
    return val


@dataclass
class Source:
    name: str
    url: str
    region: str = "world"
    weight: int = 5
    enabled: bool = True
    tier: str = ""            # اختیاری: TIER_1_OFFICIAL .. TIER_4_AGGREGATOR
    is_official: bool = False  # منبع رسمی (باشگاه/فدراسیون/لیگ)


@dataclass
class SelectionConfig:
    max_items: int = 8
    max_age_hours: int = 36
    boost_keywords: list[str] = field(default_factory=list)


@dataclass
class ContentConfig:
    language: str = "fa"
    tone: str = "خبری و روان"
    model: str = "claude-sonnet-5"
    words_per_item: int = 90
    show_name: str = "فوت‌کست"
    # هویت ثابت برنامه
    host_name: str = "ساشا"
    intro_signature: str = (
        "سلام. من {host} هستم و امروز {date}، "
        "با تازه‌ترین و مهم‌ترین خبرهای فوتبال ایران و جهان همراه شما هستم."
    )
    outro_signature: str = (
        "من {host} هستم و اینجا فوتبال را دنبال می‌کنیم، "
        "نه هر چیزی را که لباس خبر پوشیده است. تا بسته بعدی، مراقب خودتان باشید."
    )
    follow_invite: str = "اگر از این برنامه خوشتان آمد، دنبالش کنید تا بسته بعدی از دستتان نرود."


@dataclass
class AudioConfig:
    sample_rate: int = 48000
    target_lufs: float = -16.0
    max_true_peak_db: float = -1.0
    intro_path: str = ""
    outro_path: str = ""


@dataclass
class Config:
    sources: list[Source]
    selection: SelectionConfig
    content: ContentConfig
    audio: AudioConfig = None  # type: ignore[assignment]
    output_dir: Path = DEFAULT_OUTPUT_DIR

    def __post_init__(self):
        if self.audio is None:
            self.audio = AudioConfig()

    # --- کلیدهای API از محیط ---
    @property
    def anthropic_api_key(self) -> str | None:
        return _clean_key(os.getenv("ANTHROPIC_API_KEY"))

    @property
    def elevenlabs_api_key(self) -> str | None:
        return _clean_key(os.getenv("ELEVENLABS_API_KEY"))

    @property
    def elevenlabs_voice_id(self) -> str:
        # صدای پیش‌فرض برنامه (قابل بازنویسی با ELEVENLABS_VOICE_ID در .env)
        return os.getenv("ELEVENLABS_VOICE_ID", "pqHfZKP75CvOlQylNhV4")

    @property
    def elevenlabs_model_id(self) -> str:
        return os.getenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")

    @property
    def tts_provider(self) -> str:
        # پیش‌فرض: اگر کلید ElevenLabs باشد از آن، وگرنه mock
        default = "elevenlabs" if self.elevenlabs_api_key else "mock"
        return os.getenv("TTS_PROVIDER", default)

    @property
    def asr_provider(self) -> str:
        return os.getenv("ASR_PROVIDER", "mock")

    @property
    def enabled_sources(self) -> list[Source]:
        return [s for s in self.sources if s.enabled]


def load_config(path: str | Path = DEFAULT_CONFIG_PATH) -> Config:
    """کانفیگ را از فایل YAML می‌خواند و شیء Config می‌سازد."""
    path = Path(path)
    with path.open("r", encoding="utf-8") as fh:
        raw = yaml.safe_load(fh) or {}

    sources = [
        Source(
            name=s["name"],
            url=s["url"],
            region=s.get("region", "world"),
            weight=int(s.get("weight", 5)),
            enabled=bool(s.get("enabled", True)),
            tier=s.get("tier", ""),
            is_official=bool(s.get("is_official", False)),
        )
        for s in raw.get("sources", [])
    ]

    sel = raw.get("selection", {})
    selection = SelectionConfig(
        max_items=int(sel.get("max_items", 8)),
        max_age_hours=int(sel.get("max_age_hours", 36)),
        boost_keywords=list(sel.get("boost_keywords", [])),
    )

    cnt = raw.get("content", {})
    _default_content = ContentConfig()
    content = ContentConfig(
        language=cnt.get("language", "fa"),
        tone=cnt.get("tone", "خبری و روان"),
        model=cnt.get("model", "claude-sonnet-5"),
        words_per_item=int(cnt.get("words_per_item", 90)),
        show_name=cnt.get("show_name", "فوت‌کست"),
        host_name=cnt.get("host_name", _default_content.host_name),
        intro_signature=cnt.get("intro_signature", _default_content.intro_signature),
        outro_signature=cnt.get("outro_signature", _default_content.outro_signature),
        follow_invite=cnt.get("follow_invite", _default_content.follow_invite),
    )

    aud = raw.get("audio", {})
    audio = AudioConfig(
        sample_rate=int(aud.get("sample_rate", 48000)),
        target_lufs=float(aud.get("target_lufs", -16.0)),
        max_true_peak_db=float(aud.get("max_true_peak_db", -1.0)),
        intro_path=aud.get("intro_path", "") or os.getenv("INTRO_AUDIO_PATH", ""),
        outro_path=aud.get("outro_path", "") or os.getenv("OUTRO_AUDIO_PATH", ""),
    )

    return Config(sources=sources, selection=selection, content=content, audio=audio)
