"""Reimport actual agent-exported custom CAD and inspect every panel STL shell."""
import json, math, pathlib, struct, zipfile, collections, sys
import cadquery as cq
root=pathlib.Path(__file__).resolve().parent.parent
evidence=json.loads((pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else root/'test-results/mcp/evidence.json').read_text())
manifest=json.loads(pathlib.Path(evidence['artifacts']['manifest']['path']).read_text())
panels=manifest['panels'];geometry=cq.importers.importStep(evidence['artifacts']['step']['path'])
solids=geometry.solids().vals()
assert len(solids)==len(panels),(len(solids),len(panels))
assert all(s.isValid() for s in solids)
def polygon_area(points):
    return abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(points,points[1:]+points[:1])))/2
def panel_volume(p):
    if p.get('footprint'):return polygon_area(p['footprint']['polygon'])*p['footprint']['depth']
    return (p['width']*p['height']-sum(math.pi*h['radius']**2 for h in p['holes'])-sum(o['width']*o['height'] for o in p.get('openings',[])))*p['thickness']
expected=sum(panel_volume(p) for p in panels)
actual=sum(s.Volume() for s in solids)
assert math.isclose(actual,expected,rel_tol=1e-7),(actual,expected)
box=geometry.val().BoundingBox();project=manifest['project']
assert math.isclose(box.xmin,0,abs_tol=1e-6) and math.isclose(box.ymin,0,abs_tol=1e-6) and math.isclose(box.zmin,0,abs_tol=1e-6)
assert math.isclose(box.xmax,project['layout']['width'],abs_tol=1e-6)
assert math.isclose(box.ymax,project['layout']['height'],abs_tol=1e-6)
assert math.isclose(box.zmax,project['layout']['depth'],abs_tol=1e-6)
with zipfile.ZipFile(evidence['artifacts']['bundle']['path']) as archive:
    for p in panels:
        data=archive.read('panels/'+p['id']+'.stl');count=struct.unpack_from('<I',data,80)[0];edges=collections.Counter();volume=0
        for i in range(count):
            triangle=struct.unpack_from('<12f',data,84+i*50)[3:];a,b,c=[triangle[j:j+3] for j in (0,3,6)]
            volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6
            vertices=[tuple(round(v,3) for v in point) for point in (a,b,c)]
            for j in range(3):edges[tuple(sorted((vertices[j],vertices[(j+1)%3])))]+=1
        assert all(n==2 for n in edges.values()),p['id']
        assert math.isclose(abs(volume),panel_volume(p),rel_tol=6e-4),p['id']
    compile(archive.read('enclosure.py').decode(),'enclosure.py','exec')
print(f'Agent CAD verified: {len(solids)} valid STEP solids, exact physical material volume and cabinet bounds, every STL shell closed with expected volume, generated CAD script syntax valid.')
