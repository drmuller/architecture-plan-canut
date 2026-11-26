#!/usr/bin/env python3
"""Build the portable root page from editable dist sources (no external packages)."""
import base64,hashlib,pathlib,re
repo=pathlib.Path(__file__).resolve().parents[1]
root=repo/'dist'
# Local modules in dependency order. Each keeps its own scope in the standalone page.
MODULES=['design-format.js','surface-materials.js','textures.js','daylight.js','section-cut.js','view-joystick.js','surface-editor.js','furniture-models.js','character-model.js','render-pipeline.js','walkthrough.js','app.js']
# Three.js add-ons, also in dependency order. Each keeps its own scope.
ADDONS=['CopyShader.js','OutputShader.js','SimplexNoise.js','PoissonDenoiseShader.js','GTAOShader.js','Pass.js','ShaderPass.js','MaskPass.js','EffectComposer.js','RoomEnvironment.js','GTAOPass.js','OutputPass.js']
# Version local modules too: WebViews may otherwise keep stale module responses.
local_sources=sorted(root.glob('*.js'))+[root/'style.css',root/'index.html']
normalize=lambda text:re.sub(r'\?v=[0-9a-f]{12}', '', text)
version=hashlib.sha256(''.join(normalize(p.read_text()) for p in local_sources).encode()).hexdigest()[:12]
for source in root.glob('*.js'):
    text=normalize(source.read_text())
    updated=re.sub(r"from '(\./[^/'?]+\.js)'",lambda m:"from '"+m[1]+"?v="+version+"'",text)
    if source.read_text()!=updated:source.write_text(updated)
entry=root/'index.html'
text=normalize(entry.read_text())
text=re.sub(r'((?:src|href)=")((?:app|shared-sync)\.js|style\.css)(")',lambda m:m[1]+m[2]+'?v='+version+m[3],text)
if entry.read_text()!=text:entry.write_text(text)
three=(root/'vendor/three.module.js').read_text()
match=re.search(r'export\s*\{([^}]+)\};?\s*$',three)
assert match,'Three.js export block missing'
entries=[]
for entry in match.group(1).split(','):
    parts=entry.strip().split(' as ')
    entries.append(parts[1]+':'+parts[0] if len(parts)==2 else parts[0])
three=three[:match.start()]+'\nreturn {'+','.join(entries)+'};'
def vendor(path):
    """Turn a Three.js add-on module into `const {exports}=(()=>{...})();`."""
    code=path.read_text()
    code=re.sub(r"import\s*\{([^}]+)\}\s*from 'three';",r'const {\1}=THREE;',code)
    # Sibling add-ons are already in the enclosing scope.
    code=re.sub(r"import\s*\{[^}]+\}\s*from '\./[^']+';\n?",'',code)
    assert not re.search(r'^import\b',code,flags=re.M),'Unhandled import in '+path.name
    exported=re.search(r'export\s*\{([^}]+)\};?',code)
    assert exported,'Export block missing in '+path.name
    names=','.join(name.strip() for name in exported.group(1).split(','))
    return 'const {'+names+'}=(()=>{'+code[:exported.start()]+'return {'+names+'};'+code[exported.end():]+'})();'
EXPORT=re.compile(r'^export (?:async )?(?:function\*?|const|let|class) ([A-Za-z_$][\w$]*)',re.M)
provided={}
def local(name):
    """Wrap a local module as `const {exports}=(()=>{...})();`, checking what it imports."""
    code=normalize((root/name).read_text())
    for names,source in re.findall(r"^import \{([^}]+)\} from '\./([^/']+\.js)';$",code,flags=re.M):
        missing=[n.strip() for n in names.split(',') if n.strip() not in provided.get(source,())]
        assert not missing,name+' imports '+', '.join(missing)+' from '+source+' before it is defined (one export per declaration, modules in dependency order)'
    code=re.sub(r'^import .*?;\n','',code,flags=re.M)
    assert not re.search(r'^import\b',code,flags=re.M),'Keep imports on one line in '+name
    names=EXPORT.findall(code);provided[name]=set(names)
    body=re.sub(r'^export ','',code,flags=re.M)
    return ('const {'+','.join(names)+'}=' if names else '')+'(()=>{'+body+('\nreturn {'+','.join(names)+'};' if names else '')+'})();'
parts=['const THREE=(()=>{'+three+'})();',vendor(root/'vendor/OrbitControls.js')]
parts+=[vendor(root/'vendor/addons'/name) for name in ADDONS]
parts+=[local(name) for name in MODULES]
js='(()=>{'+'\n'.join(parts)+'})();'
css='\n'.join(line for line in (root/'style.css').read_text().splitlines() if not line.startswith('@import'))
html=normalize((root/'index.html').read_text()).replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
html=re.sub(r'<script type="importmap">.*?</script>','',html)
image='data:image/png;base64,'+base64.b64encode((root/'plan.png').read_bytes()).decode()
html=html.replace('src="plan.png"','src="'+image+'"')
assert '<script type="module" src="app.js"></script>' in html,'Entry script tag missing'
html=html.replace('<script type="module" src="app.js"></script>','<script>'+js.replace('</script','<\\/script')+'</script>')
session_code=(root/'shared-session.js').read_text().replace('export ','')
sync_code=re.sub(r'^import .*?;\n','',(root/'shared-sync.js').read_text(),flags=re.M)
html=html.replace('<script type="module" src="shared-sync.js"></script>','<script>'+session_code+sync_code+'</script>')
for name in ['shared-config.js']:
    if (root/name).exists():html=html.replace('<script src="'+name+'"></script>','<script>'+(root/name).read_text().replace('</script','<\\/script')+'</script>')
(repo/'index.html').write_text(html)
print('Built index.html from dist sources.')
