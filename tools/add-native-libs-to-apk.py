"""Add JNI shared libraries from an AAR to a standalone APK."""

from __future__ import annotations

import sys
import zipfile


def clone(info: zipfile.ZipInfo) -> zipfile.ZipInfo:
    result = zipfile.ZipInfo(info.filename, info.date_time)
    result.comment, result.extra = info.comment, info.extra
    result.create_system, result.create_version = info.create_system, info.create_version
    result.extract_version, result.flag_bits = info.extract_version, info.flag_bits
    result.internal_attr, result.external_attr, result.compress_type = info.internal_attr, info.external_attr, info.compress_type
    return result


def main(apk: str, *args: str) -> None:
    if len(args) < 2:
        raise SystemExit("usage: add-native-libs-to-apk.py APK SOURCE... OUT_APK")
    *sources, out = args
    with zipfile.ZipFile(apk) as source, zipfile.ZipFile(out, "w", allowZip64=True) as dest:
        for entry in source.infolist():
            dest.writestr(clone(entry), source.read(entry.filename))
        seen = set()
        for source_name in sources:
            if source_name.lower().endswith(".aar"):
                with zipfile.ZipFile(source_name) as native:
                    for entry in native.infolist():
                        if entry.filename.startswith("jni/") and entry.filename.endswith(".so"):
                            target_name = "lib/" + entry.filename[4:]
                            if target_name in seen:
                                continue
                            seen.add(target_name)
                            target = zipfile.ZipInfo(target_name, entry.date_time)
                            target.compress_type = zipfile.ZIP_STORED
                            dest.writestr(target, native.read(entry.filename))
            elif source_name.lower().endswith(".so"):
                import os
                abi = os.path.basename(os.path.dirname(source_name))
                target_name = "lib/" + abi + "/" + os.path.basename(source_name)
                if target_name not in seen:
                    seen.add(target_name)
                    target = zipfile.ZipInfo(target_name)
                    target.compress_type = zipfile.ZIP_STORED
                    with open(source_name, "rb") as raw:
                        dest.writestr(target, raw.read())


if __name__ == "__main__":
    main(*sys.argv[1:])
