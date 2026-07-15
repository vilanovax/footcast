"""رابط خط فرمان فوت‌کست."""

from __future__ import annotations

from pathlib import Path

import click

from .config import load_config
from .pipeline import build_draft, run_full, synthesize_draft


@click.group()
def cli() -> None:
    """فوت‌کست — استخراج اخبار فوتبال و تبدیل به فایل صوتی."""


@cli.command()
@click.option("--config", "config_path", default=None, help="مسیر فایل کانفیگ YAML")
def draft(config_path: str | None) -> None:
    """جمع‌آوری، تولید و بازبینی محتوا (بدون تولید صوت)."""
    cfg = load_config(config_path) if config_path else load_config()
    build_draft(cfg)


@cli.command()
@click.argument("json_path", type=click.Path(exists=True))
@click.option("--out", "out_path", default=None, help="مسیر خروجی فایل صوتی MP3")
@click.option("--config", "config_path", default=None, help="مسیر فایل کانفیگ YAML")
def synthesize(json_path: str, out_path: str | None, config_path: str | None) -> None:
    """تبدیل یک پیش‌نویس تأییدشده (فایل JSON) به فایل صوتی."""
    cfg = load_config(config_path) if config_path else load_config()
    path = synthesize_draft(json_path, cfg, out_path)
    click.echo(f"فایل صوتی: {path}")


@cli.command()
@click.option("--force", is_flag=True, help="حتی اگر بازبینی تأیید نشد، صوت تولید کن")
@click.option("--config", "config_path", default=None, help="مسیر فایل کانفیگ YAML")
def run(force: bool, config_path: str | None) -> None:
    """اجرای کامل پایپلاین از جمع‌آوری خبر تا فایل صوتی."""
    cfg = load_config(config_path) if config_path else load_config()
    run_full(cfg, force=force)


def main() -> None:
    cli()


if __name__ == "__main__":
    main()
