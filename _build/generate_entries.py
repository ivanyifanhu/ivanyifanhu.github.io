"""Generate compact, server-indexable entry URLs without copying the SPA per work."""
from pathlib import Path
import html,json,re,hashlib
LANGS=('en','ja','zh');ORIGIN='https://ivanyifanhu.github.io'
def esc(s):return html.escape(str(s),quote=True)
def inline(s):return json.dumps(s,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
def target(route,lang):return 'pages/'+lang+'--'+route.replace('/','--')+'.html'
def marked(d,lang):
 t=d['titles'][lang];rich=d.get('titlesHtml',{}).get(lang)
 if lang=='en'and d.get('kind')in('article','paper'):
  if t.startswith('"')and t.endswith('"')and t.count('"')==2:t=t[1:-1]
  if rich:
   if rich.startswith('&quot;')and rich.endswith('&quot;')and rich.count('&quot;')==2:rich=rich[6:-6]
   return '&quot;'+rich.replace('&quot;',"&#x27;").replace('“',"&#x27;").replace('”',"&#x27;")+'&quot;'
  return '&quot;'+esc(t.replace('"',"'").replace('“',"'").replace('”',"'"))+'&quot;'
 if rich:return rich
 if lang=='en'and d['group']!='research':return '<em>'+esc(t)+'</em>'
 return esc(t)

def build_entry(d,lang,fontkey,stylekey,bootkey,release):
 route=('research/'if d['group']=='research'else'blog/')+d['slug'];parent='research'if d['group']=='research'else'blog'
 parentTitle={'en':{'blog':'Notes','research':'Studies'},'ja':{'blog':'ノート','research':'研究'},'zh':{'blog':'札记','research':'研究'}}[lang][parent]
 t=d['titles'][lang];url=ORIGIN+'/'+target(route,lang);img=ORIGIN+'/'+d['image']
 alternates=''.join('<link rel="alternate" hreflang="'+l+'" href="'+ORIGIN+'/'+target(route,l)+'">'for l in LANGS)
 links=''.join('<a lang="'+l+'" href="/'+target(route,l)+'"'+(' aria-current="page"'if l==lang else'')+'>'+{'en':'English','ja':'日本語','zh':'中文'}[l]+'</a>'for l in LANGS)
 meta=esc(d['authors'][lang]+' · '+str(d['year']));schema={'@context':'https://schema.org','@type':'WebPage','name':t,'url':url,'inLanguage':lang,'image':img,'isPartOf':{'@type':'WebSite','url':ORIGIN+'/'},'author':{'@type':'Person','name':'Ivan Yi-fan Hu'},'datePublished':d['publishedAt'],'dateModified':d['updatedAt']}
 return '<!doctype html><html lang="'+lang+'" data-initial-route="'+route+'"><head><meta charset="utf-8"><base href="/"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>'+esc(t)+' — Ivan Yi-fan Hu</title><meta name="description" content="'+esc(t+' — '+d['authors'][lang]+' · '+str(d['year']))+'"><link rel="canonical" href="'+url+'">'+alternates+'<link rel="alternate" hreflang="x-default" href="'+ORIGIN+'/'+target(route,'en')+'"><meta property="og:title" content="'+esc(t)+'"><meta property="og:url" content="'+url+'"><meta property="og:image" content="'+img+'"><meta name="robots" content="index,follow"><link rel="stylesheet" href="assets/fonts-source/fonts.css?v='+fontkey+'"><link rel="stylesheet" href="style.css?v='+stylekey+'"><style>.catalog-fallback{max-width:840px;margin:118px auto 0;padding:0 28px;min-height:80vh}.catalog-fallback header{display:flex;gap:22px;margin:0 0 60px}.catalog-fallback h1{font-size:clamp(28px,3.6vw,42px);line-height:1.4}.catalog-fallback .detail-illustration{margin:40px 0}.catalog-fallback footer{margin:70px 0 30px;display:flex;justify-content:space-between}.catalog-fallback .copyright{text-align:center;font-size:12px;margin-top:50px}</style><script type="application/ld+json">'+inline(schema)+'</script></head><body><main class="catalog-fallback"><header>'+links+'</header><h1>'+marked(d,lang)+'</h1><p class="detail-meta">'+meta+'</p><figure class="detail-illustration"><img src="'+esc(d['image'])+'" alt="'+esc(t)+'" width="1536" height="1024" style="width:100%;height:auto;aspect-ratio:3/2;object-fit:contain"></figure><footer><a href="/'+target(parent,lang)+'">← <em>'+parentTitle+'</em></a><a href="#top">↑ top</a></footer><p class="copyright">All Rights Reserved © Ivan Yi-fan Hu</p></main><script src="catalog-entry.js?v='+bootkey+'" data-release="'+release+'"></script></body></html>'
def generate(output,catalog,release):
 output=Path(output);(output/'pages').mkdir(exist_ok=True);key=lambda p:hashlib.sha256((output/p).read_bytes()).hexdigest()[:12]
 keys=[key(p)for p in ['assets/fonts-source/fonts.css','style.css','catalog-entry.js']]
 for d in catalog:
  for l in LANGS:(output/target(('research/'if d['group']=='research'else'blog/')+d['slug'],l)).write_text(build_entry(d,l,*keys,release))
 return len(catalog)*3
if __name__=='__main__':
 import sys
 out=Path(sys.argv[1]);catalog=json.loads(Path(sys.argv[2]).read_text());print('Entries generated:',generate(out,catalog,'43'))
