#!/usr/bin/env python3
"""Non-destructive export of an MBA directory backup and external originals.

Requires Pillow. Writes a new, exclusive destination; never edits source files.
The resulting catalogue is a migration artifact, not a live sync implementation.
"""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import shutil
import unicodedata

from PIL import Image, ImageOps


def safe(value):
    value = unicodedata.normalize('NFC', str(value))
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '-', value)
    return re.sub(r'\s+', ' ', value).strip(' .-')[:100] or 'Untitled'


def label(value):
    return {'eu': 'EU', 'usa': 'USA', 'uk': 'UK', 'rmn': 'RMN', 'jq': 'JQ'}.get(
        value, safe(value.replace('-', ' ')).title())


def folder_for(tags):
    tags = set(tags)
    for prefix, base in [('medium/book/', 'Media/Books'), ('medium/film/', 'Media/Films'),
                         ('people/', 'People'), ('brand/', 'Brands')]:
        values = sorted(t[len(prefix):] for t in tags if t.startswith(prefix))
        if prefix == 'brand/' and len(values) > 1:
            values = [v for v in values if v != 'artisanal']
        if len(values) > 1:
            return 'Inbox', 'Multiple specific collection tags: ' + ', '.join(prefix + v for v in values)
        if values:
            return base + '/' + label(values[0]), prefix + values[0]
    if 'subject/interior' in tags:
        return 'Interiors', 'subject/interior'
    if 'subject/object' in tags:
        return 'Objects', 'subject/object'
    if tags.intersection({'attribute/folder/vintage', 'period/archival'}):
        origins = sorted(t[len('origin/'):] for t in tags if t.startswith('origin/'))
        if len(origins) > 1:
            return 'Vintage', 'Multiple origin tags; retained at Vintage root'
        if origins:
            return 'Vintage/' + '/'.join(label(p) for p in origins[0].split('/')), 'origin/' + origins[0]
        return 'Vintage', 'Vintage/archival without specific origin'
    if 'medium/book' in tags:
        return 'Media/Books', 'medium/book'
    if 'medium/film' in tags:
        return 'Media/Films', 'medium/film'
    if any(t.startswith('medium/') for t in tags):
        return 'Media', 'Other media'
    return 'Inbox', 'No clear collection'


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def contained(root, relative):
    path = (root / relative).resolve()
    if not path.is_relative_to(root):
        raise ValueError('Source path escapes root: ' + str(relative))
    return path


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def run(backup, originals, output, workers):
    backup, originals, output = backup.resolve(), originals.resolve(), output.resolve()
    if output.is_relative_to(originals) or output.is_relative_to(backup):
        raise ValueError('Export must be separate from the original/backup trees')
    items = [json.loads(line) for line in (backup / 'items.ndjson').read_text().splitlines() if line.strip()]
    manifest = json.loads((backup / 'manifest.json').read_text())
    if manifest.get('itemCount') != len(items):
        raise ValueError('Backup count mismatch')
    for key in ('id', 'itemUuid'):
        values = [i.get(key) for i in items]
        if not all(isinstance(v, str) and v for v in values) or len(set(values)) != len(values):
            raise ValueError('Missing or duplicate ' + key)
    # Create only after input validation, and refuse any existing destination.
    output.mkdir(parents=True, exist_ok=False)
    write_json(output / 'manifest.json', {'status': 'building', 'itemCount': len(items)})
    metadata = output / 'metadata'
    metadata.mkdir()
    raw = metadata / 'source-backup'
    raw.mkdir()
    for source in sorted(backup.iterdir()):
        if source.is_file() and source.suffix in ('.json', '.ndjson'):
            shutil.copy2(source, raw / source.name)
            if sha256(source) != sha256(raw / source.name):
                raise ValueError('Raw backup copy failed verification')
    preview_root = output / 'preserved-previews'
    preview_root.mkdir()
    # Materialize the agreed structure, including currently empty collection folders.
    folders = {'Inbox', 'Brands', 'Vintage', 'People', 'Media', 'Media/Books', 'Media/Films', 'Interiors', 'Objects'}
    for item in items:
        for tag in item.get('tags', []):
            for prefix, base in [('brand/', 'Brands'), ('people/', 'People'), ('origin/', 'Vintage'),
                                 ('medium/book/', 'Media/Books'), ('medium/film/', 'Media/Films')]:
                if tag.startswith(prefix):
                    folders.add(base + '/' + '/'.join(label(p) for p in tag[len(prefix):].split('/')))
    for variant in ('images', 'image-thumbs', 'image-thumbs-mobile'):
        for folder in folders:
            (output / 'public' / variant / folder).mkdir(parents=True, exist_ok=True)

    def process(item):
        uid = item['itemUuid']
        folder, reason = folder_for(item.get('tags', []))
        name = re.sub(r'\.(?:jpe?g|png|webp|heic|tiff?)$', '', item.get('name', ''), flags=re.I)
        if re.fullmatch(r'(?:images?|img)[ _-]?\d+(?:[ _-]\d+)?', name, flags=re.I) and folder != 'Inbox':
            name = folder.split('/')[-1] + ' - ' + name
        stem = safe(name) + '--' + safe(uid)
        result = {'itemUuid': uid, 'legacyId': item['id'], 'name': item.get('name', ''),
                  'tags': item.get('tags', []), 'folder': folder, 'folderReason': reason,
                  'originalStatus': 'unresolved', 'sourceMetadata': item, 'assets': {}, 'warnings': []}
        ppath = item.get('images', {}).get('preview', {}).get('packagePath')
        preview = contained(backup, ppath) if ppath else None
        if preview and not preview.is_file():
            result['warnings'].append('Referenced preview file missing')
            preview = None
        if preview:
            preserved = preview_root / (safe(uid) + preview.suffix.lower())
            shutil.copy2(preview, preserved)
            if sha256(preview) != sha256(preserved):
                raise ValueError('Preview copy mismatch: ' + uid)
            result['preservedPreview'] = str(preserved.relative_to(output))
        original = None
        rel = item.get('knownOriginalRelativePath')
        if rel:
            candidate = contained(originals, rel)
            if candidate.is_file() and not candidate.is_relative_to(backup):
                size = item.get('sourceFileSize')
                if not size or candidate.stat().st_size == size:
                    original = candidate
                    result['originalStatus'] = 'recorded-path-and-size'
        if original is None and item.get('sourceOriginalFilename', '').startswith('discord_'):
            candidate = contained(originals, 'Discord/' + item['sourceOriginalFilename'])
            if candidate.is_file() and candidate.stat().st_size == item.get('sourceFileSize'):
                original = candidate
                result['originalStatus'] = 'filename-and-size'
        source = original or preview
        if source is None:
            result['warnings'].append('No verified original or exported preview; metadata retained')
            return result
        # Decode before copying; orientation is applied only to generated thumbnails.
        with Image.open(source) as opened:
            opened.load()
            image = ImageOps.exif_transpose(opened)
            image.load()
        kind = 'original' if original else 'preview-fallback'
        if not original:
            result['warnings'].append('Original unresolved; images/ contains the exported preview as a labelled fallback')
        target = output / 'public/images' / folder / (stem + source.suffix.lower())
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        digest = sha256(source)
        if digest != sha256(target):
            raise ValueError('Image copy mismatch: ' + uid)
        result['assets']['image'] = {'path': str(target.relative_to(output)), 'kind': kind,
                                     'sha256': digest, 'byteSize': target.stat().st_size,
                                     'width': image.width, 'height': image.height, 'sourcePath': str(source)}
        for variant, edge in [('image-thumbs', 1200), ('image-thumbs-mobile', 560)]:
            thumb = image.copy()
            thumb.thumbnail((edge, edge), Image.Resampling.LANCZOS)
            alpha = 'A' in thumb.getbands() or 'transparency' in thumb.info
            thumb = thumb.convert('RGBA' if alpha else 'RGB')
            extension = '.png' if alpha else '.jpg'
            dest = output / 'public' / variant / folder / (stem + extension)
            dest.parent.mkdir(parents=True, exist_ok=True)
            if alpha:
                thumb.save(dest, format='PNG', optimize=True)
            else:
                thumb.save(dest, format='JPEG', quality=82 if edge == 1200 else 78, optimize=True)
            with Image.open(dest) as check:
                check.load()
                if check.size != thumb.size or max(check.size) > edge:
                    raise ValueError('Thumbnail verification failed: ' + uid)
            result['assets'][variant] = {'path': str(dest.relative_to(output)), 'sha256': sha256(dest),
                                         'byteSize': dest.stat().st_size, 'width': thumb.width, 'height': thumb.height}
        return result

    results = []
    with ThreadPoolExecutor(max_workers=workers) as executor:
        for index, result in enumerate(executor.map(process, items), 1):
            results.append(result)
            if index % 100 == 0 or index == len(items):
                print(f'Exported and verified {index}/{len(items)}', flush=True)
    paths = [a['path'].casefold() for r in results for a in r['assets'].values()]
    if len(paths) != len(set(paths)):
        raise ValueError('Case-insensitive destination collision')
    with (metadata / 'items.ndjson').open('w') as handle:
        for row in results:
            handle.write(json.dumps(row, ensure_ascii=False) + '\n')
    # Confirm every raw field, including unknown metadata, survived serialization.
    restored = [json.loads(line) for line in (metadata / 'items.ndjson').read_text().splitlines()]
    if [r['sourceMetadata'] for r in restored] != items:
        raise ValueError('Metadata round-trip mismatch')
    state = json.loads((backup / 'appState.json').read_text())
    write_json(metadata / 'appState.json', state)
    write_json(metadata / 'review-needed.json', [r for r in results if r['warnings'] or r['folder'] == 'Inbox'])
    summary = {'status': 'complete-with-unresolved-originals', 'version': 1,
               'createdAt': datetime.now(timezone.utc).isoformat(), 'sourceBackup': str(backup),
               'itemCount': len(results), 'originals': sum(r['assets'].get('image', {}).get('kind') == 'original' for r in results),
               'previewFallbacks': sum(r['assets'].get('image', {}).get('kind') == 'preview-fallback' for r in results),
               'metadataOnly': sum(not r['assets'] for r in results),
               'desktopThumbnails': sum('image-thumbs' in r['assets'] for r in results),
               'mobileThumbnails': sum('image-thumbs-mobile' in r['assets'] for r in results),
               'folders': dict(sorted(Counter(r['folder'] for r in results).items())),
               'thumbnailMaxEdges': {'desktop': 1200, 'mobile': 560},
               'sourceFilesModified': False, 'appConnected': False,
               'verification': ['All copied media SHA-256 checked', 'All rendered media decoded',
                                'Thumbnail sizes checked', 'Complete metadata round-trip checked',
                                'No case-insensitive asset path collisions']}
    write_json(output / 'manifest.json', summary)
    (output / 'README.md').write_text(
        '# Local library export\n\n'
        'This is a separate migration export. The app is not connected to it yet.\n\n'
        f'{summary["originals"]} originals, {summary["previewFallbacks"]} explicitly labelled preview fallbacks, '
        f'{summary["metadataOnly"]} metadata-only record. Both thumbnail sizes exist for every available image.\n\n'
        'Media is under public/images, public/image-thumbs, and public/image-thumbs-mobile. '
        'Metadata remains outside public. metadata/items.ndjson contains complete source records, '
        'stable IDs, file hashes, variant paths, and original/fallback status. '
        'metadata/source-backup retains the original export records. preserved-previews retains every exported preview.\n\n'
        'Initial folder rule: named book/film, person, specific brand, interiors/objects, '
        'vintage origin, generic media, then Inbox. Competing specific names go to Inbox. '
        'All original tags remain intact. Folder assignments can change later.\n\n'
        'Do not treat this as proof that all original matches are visually identical. '
        'Original associations use the saved path and size or the unique Discord filename and size. '
        'Unconfirmed recovery candidates were not substituted. See metadata/review-needed.json.\n\n'
        'No folder synchronization or cloud upload was performed. Future sync must preserve '
        'stable identity across path changes and keep missing-file handling non-destructive.\n')
    print(json.dumps({k: v for k, v in summary.items() if k != 'folders'}, indent=2), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backup', type=Path, required=True)
    parser.add_argument('--originals', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--workers', type=int, default=3)
    args = parser.parse_args()
    if not 1 <= args.workers <= 8:
        parser.error('--workers must be between 1 and 8')
    run(args.backup, args.originals, args.output, args.workers)
