"""Build the public wiki with Python's standard library; no private-repo access."""
import html
import json
import re
import shutil
from pathlib import Path
from image_assets import restore

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist'
CATEGORIES = [
    {'id': 'guides', 'name': '플레이 길라잡이', 'label': 'GUIDE', 'description': '첫 모험 준비부터 재배와 섬 꾸미기까지', 'icon': 'compass'},
    {'id': 'crops', 'name': '서버 작물', 'label': 'FARMING', 'description': '심는 곳, 성장 과정, 수확과 가격', 'icon': 'sprout'},
    {'id': 'trees', 'name': '전용 나무', 'label': 'TREES', 'description': '작은 살구나무부터 거대한 세계나무까지', 'icon': 'tree'},
    {'id': 'wood', 'name': '목재 세트', 'label': 'BUILDING', 'description': '나만의 섬을 만드는 여덟 가지 목재', 'icon': 'blocks'},
    {'id': 'decor', 'name': '장식 블록', 'label': 'DECORATION', 'description': '등불과 바구니로 채우는 작은 풍경', 'icon': 'lamp'},
    {'id': 'dungeon', 'name': '던전 도감', 'label': 'DUNGEON', 'description': '입장 준비부터 여섯 종류의 방과 보상까지', 'icon': 'swords'},
    {'id': 'guild', 'name': '탐험단', 'label': 'GUILD', 'description': '함께 쌓는 의뢰, 탐사와 탐험단의 성장', 'icon': 'users'},
]


def inline(text):
    tokens = []

    def save(value):
        tokens.append(value)
        return '\x00%d\x00' % (len(tokens) - 1)

    text = re.sub(r'<img src="(images/[a-zA-Z0-9_/.-]+\.png)" width="(\d+)" alt="">',
                  lambda m: save('<img src="%s" width="%s" height="%s" alt="" loading="lazy" decoding="async">' % (m[1], m[2], m[2])), text)
    text = text.replace('<br>', '\n')
    text = re.sub(r'`([^`]+)`', lambda m: save('<code>' + html.escape(m[1]) + '</code>'), text)
    text = html.escape(text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'\[([^\]]+)\]\((#[^\s)]+)\)', r'<a href="\2">\1</a>', text)
    text = text.replace('\n', '<br>')
    return re.sub(r'\x00(\d+)\x00', lambda m: tokens[int(m[1])], text)


def markdown(source):
    lines = source.strip().splitlines()
    result, index = [], 0
    while index < len(lines):
        line = lines[index]
        if not line.strip():
            index += 1
            continue
        if line.startswith('|'):
            rows = []
            while index < len(lines) and lines[index].startswith('|'):
                cells = re.split(r'(?<!\\)\|', lines[index].strip().strip('|'))
                rows.append([c.strip().replace('\\|', '|') for c in cells])
                index += 1
            if len(rows) > 1 and all(re.fullmatch(r':?-+:?', c) for c in rows[1]):
                head = '<thead><tr>' + ''.join('<th scope="col">' + inline(c) + '</th>' for c in rows[0]) + '</tr></thead>'
                body = '<tbody>' + ''.join('<tr>' + ''.join('<td>' + inline(c) + '</td>' for c in row) + '</tr>' for row in rows[2:]) + '</tbody>'
                result.append('<div class="table-scroll" tabindex="0" role="region" aria-label="상세 정보 표"><table>' + head + body + '</table></div>')
            continue
        match = re.match(r'^(#{2,4}) (.+)', line)
        if match:
            level = len(match[1])
            result.append('<h%d>%s</h%d>' % (level, inline(match[2]), level))
            index += 1
            continue
        if line.startswith('- '):
            items = []
            while index < len(lines) and lines[index].startswith('- '):
                items.append('<li>' + inline(lines[index][2:]) + '</li>')
                index += 1
            result.append('<ul>' + ''.join(items) + '</ul>')
            continue
        if line.startswith('> '):
            result.append('<aside class="notice">' + inline(line[2:]) + '</aside>')
            index += 1
            continue
        paragraph = [line]
        index += 1
        while index < len(lines) and lines[index].strip() and not re.match(r'^(#|\||- |>)', lines[index]):
            paragraph.append(lines[index])
            index += 1
        result.append('<p>' + inline(' '.join(paragraph)) + '</p>')
    return '\n'.join(result)


def text_only(source):
    source = re.sub(r'<[^>]+>', ' ', source)
    source = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', source)
    return re.sub(r'\s+', ' ', source.replace('`', '').replace('*', '').replace('|', ' ')).strip()


def article(category, title, group, source, number, fixed_id=None):
    images = re.findall(r'src="(images/[^"]+)"', source)
    picture = images[0] if images else None
    if category == 'crops' and len(images) > 1:
        picture = images[1]
    summary = text_only(source)
    if category == 'crops':
        harvest = re.search(r'\| \| \| 수확 \| (.*?) \|', source)
        summary = (harvest[1] if harvest else '성장을 돕는 특별한 아이템') + ' · ' + group
    elif category in ('trees', 'wood'):
        summary = text_only(source.split('\n\n')[0]) if category == 'trees' else title + '로 만드는 건축 블록과 조합법'
    elif category == 'decor':
        summary = title + '의 모양과 만드는 법을 확인하세요.'
    if not fixed_id:
        if category == 'crops':
            item = re.search(r'images/(?:fruits/([^/]+)\.png|crops/([^/]+)/fruit_block\.png)', source)
            slug = (item[1] or item[2]) if item else 'growth-booster'
        elif category in ('trees', 'wood'):
            item = re.search(r'images/(?:trees|wood)/([^/]+)_(?:log|stairs)\.png', source)
            slug = item[1] if item else str(number)
        else:
            slug = {'더미 · 초가지붕 · 구름 솜':'bales-and-roofs', '버섯 갓 블럭':'mushroom-caps', '화분':'flower-pots', '조각한 열매 · 등불':'carved-fruits', '등':'lanterns', '꽃잎 · 낙엽 · 물 위 장식':'petals-and-water', '바구니':'baskets', '말림 장식':'drying'}.get(title, str(number))
        fixed_id = category + '-' + slug
    rendered = markdown(source)
    rendered = re.sub(r'(<img src="images/crops/[^/]+/([^"/]+)\.png"[^>]*?)alt=""',
                      lambda m: m[1] + 'alt="' + html.escape(title + ' 성장 모습: ' + m[2], quote=True) + '"', rendered)
    return {'id': fixed_id, 'category': category, 'title': title, 'group': group,
            'summary': summary[:130], 'image': picture, 'html': rendered, 'search': title + ' ' + group + ' ' + text_only(source)}


def collect():
    articles = []
    for name, category in [('작물.md', 'crops'), ('전용_나무.md', 'trees'), ('목재_세트.md', 'wood'), ('장식_블럭.md', 'decor')]:
        source = (ROOT / 'content' / name).read_text()
        group, title, body, number, growing_notes = '', None, [], 0, []

        def flush():
            nonlocal number
            if title:
                number += 1
                prefix = '\n'.join(growing_notes) + '\n\n모든 작물은 빛 9 이상에서 자랍니다.\n\n' if category == 'crops' and group != '재배 도구' else ''
                articles.append(article(category, title, group, prefix + '\n'.join(body), number))

        for line in source.splitlines():
            if category == 'crops' and line.startswith('## '):
                flush()
                title, body = None, []
                group = line[3:]
                growing_notes = []
                if group == '성장 촉진제':
                    title = group
                    group = '재배 도구'
            elif line.startswith('### ') if category == 'crops' else line.startswith('## '):
                flush()
                title, body = line[(4 if category == 'crops' else 3):], []
            elif title:
                body.append(line)
            elif category == 'crops' and group and line.strip():
                growing_notes.append(line)
        flush()
    for collection in ('guides', 'dungeon', 'guild'):
        label = next(c['name'] for c in CATEGORIES if c['id'] == collection)
        for path in sorted((ROOT / 'content' / collection).glob('*.md')):
            source = path.read_text()
            title, _, body = source.partition('\n')
            identity = path.stem if collection == 'guides' else collection + '-' + path.stem
            a = article(collection, title.removeprefix('# '), label, body, 0, identity)
            first = next((line for line in body.splitlines() if line.strip() and not line.startswith(('#', '>', '<img'))), '')
            a['summary'] = text_only(first)[:130]
            articles.append(a)
    return articles


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    for filename in ['index.html', 'styles.css', 'app.js', 'favicon.svg']:
        shutil.copy(ROOT / filename, OUT / filename)
    image_names = restore(OUT)
    shutil.copy(ROOT / 'LICENSE', OUT / 'LICENSE.txt')
    (OUT / '.nojekyll').write_text('')
    articles = collect()
    data = {'updated': '2026-10-25', 'categories': CATEGORIES, 'articles': articles}
    (OUT / 'data.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    image_refs = set()
    for a in articles:
        for image in re.findall(r'src="([^"]+)"', a['html']):
            assert (OUT / image).is_file(), image
            image_refs.add(image)
        assert '<script' not in a['html']
    assert len({a['id'] for a in articles}) == len(articles)
    assert len([a for a in articles if a['category'] == 'crops' and a['group'] != '재배 도구']) == 56
    assert image_refs == image_names, 'Image bundles must match the published article images'
    print(f'Built {len(articles)} articles; {len(image_names)} original PNGs and all references verified.')


if __name__ == '__main__':
    main()
