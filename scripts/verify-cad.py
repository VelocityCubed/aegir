"""Independent CAD round-trip checks. Run after npm test and npm run test:e2e."""
import importlib.util
import json
import math
import pathlib
import zipfile

import cadquery as cq
import ezdxf

root = pathlib.Path(__file__).resolve().parent.parent
out = root / 'test-results'
spec = importlib.util.spec_from_file_location('cad_backend', root / 'cad' / 'export_step.py')
backend = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backend)
project = json.loads((out / 'project.json').read_text())
js_panels = json.loads((out / 'panels.json').read_text())
py_panels = backend.make_panels(project)
assert len(js_panels) == len(py_panels)
for a, b in zip(js_panels, py_panels):
    assert a['id'] == b['id']
    for key in ['width', 'height', 'thickness']:
        assert math.isclose(a[key], b[key], abs_tol=1e-8), (key, a, b)
    for key in ['position', 'rotation']:
        assert all(math.isclose(x, y, abs_tol=1e-8) for x, y in zip(a[key], b[key])), (key, a, b)
    assert len(a['holes']) == len(b['holes'])
    for ah, bh in zip(a['holes'], b['holes']):
        assert all(math.isclose(ah[key], bh[key], abs_tol=1e-8) for key in ['x', 'y', 'radius'])

backend.export(project, out / 'baseline.step')
solid = cq.importers.importStep(str(out / 'baseline.step'))
expected = sum((p['width']*p['height']-sum(math.pi*h['radius']**2 for h in p['holes']))*p['thickness'] for p in js_panels)
assert len(solid.solids().vals()) == len(js_panels)
assert all(s.isValid() for s in solid.solids().vals())
assert math.isclose(sum(s.Volume() for s in solid.solids().vals()), expected, rel_tol=1e-8)

for zip_path in [out/'example-build.zip', out/'Quarter-wave-study-build.zip']:
    with zipfile.ZipFile(zip_path) as bundle:
        for name in bundle.namelist():
            if name.endswith('.dxf'):
                doc = ezdxf.read(__import__('io').StringIO(bundle.read(name).decode()))
                assert doc.header['$INSUNITS'] == 4
                assert len(doc.modelspace().query('POLYLINE')) == 1
                assert doc.modelspace().query('POLYLINE')[0].is_closed
                assert not doc.audit().has_errors

e2e_step = cq.importers.importStep(str(out/'enclosure.step'))
assert len(e2e_step.solids().vals()) >= 5
assert all(s.isValid() for s in e2e_step.solids().vals())
print(f'CAD verification passed: JS/Python panel parity, {len(js_panels)} exact STEP solids, analytic material volume, STEP roundtrip, metric closed DXF profiles, E2E STEP validity.')
