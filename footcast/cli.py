"""رابط خط فرمان فوت‌کست."""

from __future__ import annotations

from pathlib import Path

import click

from .approval import approve_audio, approve_text, check_text_approval
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
    try:
        path = synthesize_draft(json_path, cfg, out_path)
    except RuntimeError as exc:
        raise click.ClickException(str(exc))
    click.echo(f"فایل صوتی: {path}")


@cli.command()
@click.option("--config", "config_path", default=None, help="مسیر فایل کانفیگ YAML")
def run(config_path: str | None) -> None:
    """اجرای پایپلاین تا مرحله تأیید متن (بدون تولید خودکار صوت)."""
    cfg = load_config(config_path) if config_path else load_config()
    run_full(cfg)


@cli.command(name="approve-text")
@click.argument("json_path", type=click.Path(exists=True))
def approve_text_cmd(json_path: str) -> None:
    """تأیید صریح متن پاک TTS (پیش‌نیاز تولید صوت)."""
    try:
        path = approve_text(json_path)
    except RuntimeError as exc:
        raise click.ClickException(str(exc))
    click.echo(f"✅ متن تأیید شد. artifact: {path}")


@cli.command(name="approve-audio")
@click.argument("json_path", type=click.Path(exists=True))
@click.option("--audio", "audio_path", default=None, help="مسیر فایل صوتی (پیش‌فرض: کنار JSON)")
def approve_audio_cmd(json_path: str, audio_path: str | None) -> None:
    """تأیید صریح فایل صوتی (پیش‌نیاز انتشار)."""
    from pathlib import Path as _P
    if audio_path:
        audio = audio_path
    else:
        # پیش‌فرض: فایل انتشار مونتاژشده، وگرنه mp3 ساده
        publish = _P(json_path).with_suffix(".audio-publish.mp3")
        audio = str(publish if publish.exists() else _P(json_path).with_suffix(".mp3"))
    try:
        path = approve_audio(json_path, audio)
    except RuntimeError as exc:
        raise click.ClickException(str(exc))
    click.echo(f"✅ صوت تأیید شد. artifact: {path}")


@cli.command(name="check-approval")
@click.argument("json_path", type=click.Path(exists=True))
def check_approval_cmd(json_path: str) -> None:
    """بررسی معتبربودن تأیید متن (تطابق هش)."""
    ok, reason = check_text_approval(json_path)
    mark = "✅" if ok else "⚠️"
    click.echo(f"{mark} {reason}")


def main() -> None:
    cli()


if __name__ == "__main__":
    main()
