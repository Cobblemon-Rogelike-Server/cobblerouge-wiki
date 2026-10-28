"""Check the external links actually rendered by check-ui.mjs, without login or cookies."""
import argparse
import json
import os
from pathlib import Path
import tempfile
import urllib.error
import urllib.parse
import urllib.request


class HTTPSRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urllib.parse.urlsplit(newurl).scheme != 'https':
            raise ValueError('Redirect leaves HTTPS')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifacts', default=os.environ.get('WIKI_UI_ARTIFACTS', str(Path(tempfile.gettempdir()) / 'cobblerouge-wiki-preview')))
    args = parser.parse_args()
    folder = Path(args.artifacts)
    audit = json.loads((folder / 'link-audit.json').read_text(encoding='utf-8'))
    urls = {}
    for row in audit['links']:
        if row['kind'] == 'external':
            urls.setdefault(row['href'], []).append({'source': row['source'], 'label': row['label']})
    opener = urllib.request.build_opener(HTTPSRedirects())
    results = []
    for url, sources in sorted(urls.items()):
        result = {'url': url, 'sources': sources}
        try:
            parsed = urllib.parse.urlsplit(url)
            if parsed.scheme != 'https' or parsed.username or parsed.password:
                raise ValueError('Expected an HTTPS URL without credentials')
            request = urllib.request.Request(url, headers={'User-Agent': 'CobbleRougeWiki-LinkCheck/1.0'})
            with opener.open(request, timeout=20) as response:
                final = response.geturl()
                response.read(1024)
                result.update(http_status=response.status, final_url=final)
                # GitHub requires authentication to create an issue, even in a public repository.
                login = urllib.parse.urlsplit(final).path.startswith('/login')
                expected_login = parsed.hostname == 'github.com' and parsed.path.endswith('/issues/new')
                result['status'] = 'authentication-required' if login and expected_login else ('unverified' if login else 'passed')
                if login:
                    result['reason'] = 'GitHub login required to create an issue' if expected_login else 'Unexpected login redirect'
        except urllib.error.HTTPError as error:
            result.update(http_status=error.code, status='failed' if error.code in (404, 410) else 'unverified', reason=str(error))
        except (OSError, ValueError, urllib.error.URLError) as error:
            result.update(status='unverified', reason=str(error))
        results.append(result)
        print(f"{result['status']}: {url}" + (f" ({result['reason']})" if result.get('reason') else ''))
    output = {'status': 'passed' if all(r['status'] in ('passed', 'authentication-required') for r in results) else 'incomplete', 'links': results}
    (folder / 'external-links.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return 0 if output['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
