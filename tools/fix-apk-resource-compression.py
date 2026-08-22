"""Repack an APK with Android's compiled resources left uncompressed."""

from __future__ import annotations

import sys
import zipfile


def copy_info(info: zipfile.ZipInfo, compression: int) -> zipfile.ZipInfo:
    copied = zipfile.ZipInfo(info.filename, info.date_time)
    copied.comment = info.comment
    copied.extra = info.extra
    copied.create_system = info.create_system
    copied.create_version = info.create_version
    copied.extract_version = info.extract_version
    copied.flag_bits = info.flag_bits
    copied.internal_attr = info.internal_attr
    copied.external_attr = info.external_attr
    copied.compress_type = compression
    return copied


def main(source: str, destination: str) -> None:
    with zipfile.ZipFile(source, "r") as incoming, zipfile.ZipFile(
        destination, "w", allowZip64=True
    ) as outgoing:
        for info in incoming.infolist():
            compression = zipfile.ZIP_STORED if info.filename == "resources.arsc" else info.compress_type
            outgoing.writestr(copy_info(info, compression), incoming.read(info.filename))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: fix-apk-resource-compression.py <input.apk> <output.apk>")
    main(sys.argv[1], sys.argv[2])
