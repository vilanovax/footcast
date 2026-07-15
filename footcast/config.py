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


@dataclass
class Source:
    name: str
    url: str
    region: str = "world"
    weight: int = 5
    enabled: bool = True


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


@dataclass
class Config:
    sources: list[Source]
    selection: SelectionConfig
    content: ContentConfig
    output_dir: Path = DEFAULT_OUTPUT_DIR

    # --- کلیدهای API از محیط ---
    @property
    def anthropic_api_key(self) -> str | None:
        return os.getenv("ANTHROPIC_API_KEY")

    @property
    def elevenlabs_api_key(self) -> str | None:
        return os.getenv("ELEVENLABS_API_KEY")

    @property
    def elevenlabs_voice_id(self) -> str:
        return os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")

    @property
    def elevenlabs_model_id(self) -> str:
        return os.getenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")

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
    content = ContentConfig(
        language=cnt.get("language", "fa"),
        tone=cnt.get("tone", "خبری و روان"),
        model=cnt.get("model", "claude-sonnet-5"),
        words_per_item=int(cnt.get("words_per_item", 90)),
        show_name=cnt.get("show_name", "فوت‌کست"),
    )

    return Config(sources=sources, selection=selection, content=content)
