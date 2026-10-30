import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const local=resolve(process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python');
const python=process.env.AEGIR_PYTHON??(existsSync(local)?local:'python');
execFileSync(python,['scripts/verify-mcp-cad.py',...process.argv.slice(2)],{stdio:'inherit',windowsHide:true});
