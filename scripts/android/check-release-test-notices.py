"""Verify notices inside the actual signed release instrumentation APK."""

import argparse
from pathlib import Path
from zipfile import ZipFile

NOTICE_ROOT = Path(__file__).resolve().parents[2] / "packaging/android/release-test-notices"


def verify_instrumentation_notices(apk: Path) -> None:
    expected = sorted(path for path in NOTICE_ROOT.iterdir() if path.is_file())
    if len(expected) != 5:
        raise ValueError("The release test notice inventory must contain exactly five files")
    with ZipFile(apk) as archive:
        for source in expected:
            name = "assets/" + source.name
            metadata = archive.getinfo(name)
            content = source.read_bytes()
            if metadata.file_size != len(content) or archive.read(name) != content:
                raise ValueError("Instrumentation notice bytes differ: " + name)
        for name in ("OFL-Courier-Prime.txt", "OFL-Noto-Sans-Hebrew.txt"):
            source = NOTICE_ROOT.parents[2] / "fixtures/pdf" / name
            if archive.read("assets/" + name) != source.read_bytes():
                raise ValueError("Embedded PDF test-font license differs: " + name)
    print("Release test notices and both PDF test-font licenses match source bytes.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apk", required=True, type=Path)
    arguments = parser.parse_args()
    verify_instrumentation_notices(arguments.apk)
