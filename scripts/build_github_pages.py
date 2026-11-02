from pathlib import Path
import json, os, re, shutil
root = Path(__file__).resolve().parents[1]
config = json.loads((root/'github-pages.json').read_text())
output = root/'_site'
assert not output.exists(), 'Use a fresh checkout'
shutil.copytree(root/config['directory'], output, ignore=shutil.ignore_patterns('.openai', '.git', 'CNAME', '.env*', '*.php'))
base = '/'+config['repository']+'/'
for p in output.rglob('*'):
    if not p.is_file() or p.suffix not in {'.html','.css','.js','.mjs','.webmanifest'}:
        continue
    s = p.read_text(encoding='utf-8-sig')
    if p.suffix == '.html':
        s = re.sub(r'''((?:src|href|poster|data-src)=['"])/(?!/)([^'"]*)(['"])''', lambda m:m[1]+base+m[2]+m[3], s)
        s = s.replace("location.replace('/yaki-supreme/'", "location.replace('"+base+"yaki-supreme/'")
    if p.suffix in {'.css','.html'}:
        s = re.sub(r'''url\((['"]?)/(?!/)([^)'"\s]+)(['"]?)\)''', lambda m:'url('+m[1]+base+m[2]+m[3]+')', s)
    if p.suffix in {'.js','.mjs'}:
        s = re.sub(r'''(['"`])/(assets|shared|fonts|vendor|models)/''', lambda m:m[1]+base+m[2]+'/', s)
    if p.name == 'site.webmanifest':
        data = json.loads(s)
        for icon in data.get('icons', []):
            if icon.get('src','').startswith('/'):
                icon['src'] = base+icon['src'].lstrip('/')
        s = json.dumps(data, ensure_ascii=False)
    if config['repository'] == 'm0n0-studio' and p.name == 'index.html':
        endpoint = os.environ.get('BRIEF_API_URL','')
        assert endpoint.startswith('https://'), 'Set BRIEF_API_URL and allow https://alarm6.github.io in backend CORS before studio deployment'
        s = s.replace('data-endpoint="/api/brief"', 'data-endpoint="'+endpoint+'"')
    if config['repository'] == 'm0n0-studio' and p.name == 'projects.js':
        for old,new in config['portfolio_urls'].items():
            s = s.replace(old,new)
    p.write_text(s, encoding='utf-8')
(output/'.nojekyll').touch()
print('Prepared',config['repository'])
