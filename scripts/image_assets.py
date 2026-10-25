"""Store original PNGs losslessly in text bundles and restore them at build time."""
import argparse
import base64
import json
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]


def restore(destination):
    seen = set()
    bundles = sorted((ROOT / 'assets').glob('images-*.json'))
    if not bundles:
        raise ValueError('No image bundles found in assets/')
    for bundle in bundles:
        for name, encoded in json.loads(bundle.read_text()).items():
            path = PurePosixPath(name)
            if path.is_absolute() or '..' in path.parts or path.parts[0] != 'images' or path.suffix != '.png':
                raise ValueError(f'Invalid image path: {name}')
            if name in seen:
                raise ValueError(f'Duplicate image path: {name}')
            raw = base64.b64decode(encoded, validate=True)
            if not raw.startswith(b'\x89PNG\r\n\x1a\n'):
                raise ValueError(f'Invalid PNG: {name}')
            output = destination / path
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(raw)
            seen.add(name)
    return seen


def pack(source):
    files = sorted(source.rglob('*.png'))
    if not files:
        raise ValueError('The source directory contains no PNG files')
    assets = ROOT / 'assets'
    assets.mkdir(exist_ok=True)
    # Encode and validate before replacing the current bundles.
    entries = {}
    for path in files:
        raw = path.read_bytes()
        if not raw.startswith(b'\x89PNG\r\n\x1a\n'):
            raise ValueError(f'Invalid PNG: {path}')
        name = 'images/' + path.relative_to(source).as_posix()
        entries[name] = base64.b64encode(raw).decode('ascii')
    for old in assets.glob('images-*.json'):
        old.unlink()
    items = list(entries.items())
    for index in range(0, len(items), 100):
        target = assets / f'images-{index // 100:03d}.json'
        target.write_text(json.dumps(dict(items[index:index+100]), ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'Packed {len(files)} original PNGs without modification.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, help='Directory containing the original PNG hierarchy to pack')
    parser.add_argument('--extract-to', type=Path, help='Restore the images/ hierarchy under this directory')
    args = parser.parse_args()
    if args.source and not args.extract_to:
        pack(args.source)
    elif args.extract_to and not args.source:
        print(f'Restored {len(restore(args.extract_to))} PNGs.')
    else:
        parser.error('Choose exactly one of --source or --extract-to')
