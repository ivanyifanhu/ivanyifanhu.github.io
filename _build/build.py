"""Build only explicitly listed public website files and verified work illustrations."""
from pathlib import Path
import argparse,json,hashlib,shutil,re,importlib.util,zipfile,sys
sys.dont_write_bytecode=True
parser=argparse.ArgumentParser();parser.add_argument('--source',default='.');parser.add_argument('--output',default='_site');parser.add_argument('--inputs',default='_build');args=parser.parse_args();S=Path(args.source).resolve();O=Path(args.output).resolve();I=Path(args.inputs).resolve();O.mkdir(parents=True,exist_ok=True);assert not any(O.iterdir()),'Output directory must be empty'
allowed=json.loads((I/'site-files.json').read_text());assets=json.loads((I/'catalog-assets.json').read_text());catalog=json.loads((I/'catalog.json').read_text())
def safe(root,relative):
 p=(root/relative).resolve();assert p.is_relative_to(root)and not Path(relative).is_absolute(),relative;return p
for rel in allowed:
 src=safe(S,rel);dst=safe(O,rel);assert src.is_file()and not src.is_symlink(),rel;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dst)
# Published illustrations are bundled and hash-pinned. No external image service
# is contacted during deployment or by visitors.
expected={a['file']:a for a in assets};seen=set()
for archive in sorted((I/'illustrations').glob('*.zip')):
 with zipfile.ZipFile(archive)as z:
  for name in z.namelist():
   assert name in expected and name not in seen,name
   body=z.read(name);assert hashlib.sha256(body).hexdigest()==expected[name]['sha256'],name
   dst=safe(O,name);dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(body);seen.add(name)
assert seen==set(expected),('Missing illustrations',set(expected)-seen)
print('Verified bundled illustrations:',len(seen),flush=True)
spec=importlib.util.spec_from_file_location('entries',I/'generate_entries.py');gen=importlib.util.module_from_spec(spec);spec.loader.exec_module(gen);gen.generate(O,catalog,'43')
# Refresh shared cache identifiers in retained historical entry URLs, without altering article markup.
keys={p:hashlib.sha256((O/p).read_bytes()).hexdigest()[:12]for p in ['style.css','site.js','search.js','typography.js','catalog-entry.js','assets/fonts-source/fonts.css']}
for p in(O/'pages').glob('*.html'):
 text=p.read_text()
 for rel,key in keys.items():text=re.sub(re.escape(rel)+r'(?:\?v=[a-zA-Z0-9]+)?',lambda m:rel+'?v='+key,text)
 p.write_text(text)
expected_files=set(allowed)|set(expected)|{gen.target(('research/'if d['group']=='research'else'blog/')+d['slug'],lang)for d in catalog for lang in ['en','ja','zh']}
actual_files={str(p.relative_to(O))for p in O.rglob('*')if p.is_file()};assert actual_files==expected_files,('Unexpected or missing public files',sorted(actual_files-expected_files),sorted(expected_files-actual_files))
files={str(p.relative_to(O)):hashlib.sha256(p.read_bytes()).hexdigest()for p in O.rglob('*')if p.is_file()};total=sum(p.stat().st_size for p in O.rglob('*')if p.is_file());assert total<1000000000,('Pages site size',total)
assert len(catalog)>=1000;assert len({d['slug']for d in catalog})==len(catalog)
for d in catalog:
 for lang in ['en','ja','zh']:assert(O/gen.target(('research/'if d['group']=='research'else'blog/')+d['slug'],lang)).is_file()
(O/'release-manifest.json').write_text(json.dumps({'version':43,'notes':sum(d['group']!='research'for d in catalog),'researchProjects':sum(d['group']=='research'for d in catalog),'bytes':total,'files':files},ensure_ascii=False,separators=(',',':'))+'\n');print('Site built:',len(files),'files;',total,'bytes;',len(catalog),'new records.')
