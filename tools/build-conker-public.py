"""Package the verified Slopper edition for direct browser play."""
import importlib.util,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
LOCAL=ROOT/'local/conker';PUBLIC=ROOT/'games/conker'
spec=importlib.util.spec_from_file_location('conker_verify',LOCAL/'verify.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
digest=module.verify()
PUBLIC.mkdir(parents=True,exist_ok=True)
for name in ('index.html','app.js','style.css','title.js','native-title.js','engine.html','engine.js','engine.css','credits.html','game-manifest.json'):
    shutil.copyfile(LOCAL/name,PUBLIC/name)
for name in ('art/icon.jpg','art/stamp-hand-matte.png','art/starring-slopper.svg','data/gameslop.z64'):
    (PUBLIC/name).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(LOCAL/name,PUBLIC/name)
print('Packaged Slopper\'s Bad Fur Day:',digest)
