"""STEP export backend. Geometry mirrors src/core/geometry.ts; mm throughout."""
import json
import math
import pathlib
import sys
import cadquery as cq


def make_panels(project):
    d, v = project['design'], project['driver']
    n, t, w = d['folds'], d['thickness'], d['laneWidth']
    if n not in (1, 2, 3, 4):
        raise ValueError('Invalid pass count')
    dep = v['sd'] * 100 * d['areaRatio'] / w
    h = (d['length'] * 1000 - (n-1)*t) / n
    iw = n*w + (n-1)*t
    width, height, depth = iw+2*t, h+2*t, dep+2*t
    cx, cy = t+w/2, t+h-d['length']*1000*d['driverPosition']
    if min(dep, h, t, w) <= 0 or h < 2*w or w < v['cutout']+12 or dep < v['depth']+15:
        raise ValueError('Unbuildable enclosure dimensions')
    if cy-v['frame']/2 < t+6 or cy+v['frame']/2 > height-t-6 or cx-v['frame']/2 < 6 or cx+v['frame']/2 > width-6:
        raise ValueError('Driver frame does not fit')
    if d['length']*1000*d['driverPosition']+v['cutout']/2 > h-w:
        raise ValueError('Driver overlaps first turn')
    panels = []

    def add(name, a, b, pos, rot=(0, 0, 0), holes=()):
        panels.append(dict(id=name, width=a, height=b, thickness=t, position=pos, rotation=rot, holes=holes))

    add('front', width, height, (width/2, height/2, t/2), holes=[dict(x=cx-width/2, y=cy-height/2, radius=v['cutout']/2)])
    add('back', width, height, (width/2, height/2, depth-t/2))
    add('left', dep, height, (t/2, height/2, depth/2), (0, math.pi/2, 0))
    add('right', dep, height, (width-t/2, height/2, depth/2), (0, math.pi/2, 0))
    top = iw-w if n % 2 == 0 else iw
    bottom = iw if n % 2 == 0 else iw-w
    if top > 0:
        add('top', top, dep, (t+top/2, height-t/2, depth/2), (math.pi/2, 0, 0))
    if bottom > 0:
        add('bottom', bottom, dep, (t+bottom/2, t/2, depth/2), (math.pi/2, 0, 0))
    for j in range(n-1):
        add(f'divider-{j+1}', dep, h-w, (t+(j+1)*w+j*t+t/2, t+(w if j % 2 == 0 else 0)+(h-w)/2, depth/2), (0, math.pi/2, 0))
    return panels


def export(project, destination):
    assembly = cq.Assembly(name='Aegir_Enclosure')
    if 'layout' in project and project.get('layout') and 'panels' not in project:
        raise ValueError('Custom projects require the exported geometry-manifest.json; do not regenerate a different cabinet.')
    panels = project['panels'] if 'panels' in project else make_panels(project)
    for p in panels:
        if p.get('footprint'):
            f = p['footprint']
            part = cq.Workplane('XY').polyline(f['polygon']).close().extrude(f['depth']).translate((0, 0, f['z']))
            if not part.val().isValid():
                raise ValueError(f'Invalid CAD solid: {p["id"]}')
            assembly.add(part, name=p['id'], color=cq.Color(0.72, 0.53, 0.32))
            continue
        part = cq.Workplane('XY').box(p['width'], p['height'], p['thickness'])
        for hole in p['holes']:
            cutter = cq.Workplane('XY').center(hole['x'], hole['y']).circle(hole['radius']).extrude(p['thickness']+2, both=True)
            part = part.cut(cutter)
        for opening in p.get('openings', []):
            cutter = cq.Workplane('XY').center(opening['x'], opening['y']).rect(opening['width'], opening['height']).extrude(p['thickness']+2, both=True)
            part = part.cut(cutter)
        for axis, angle in zip([(1, 0, 0), (0, 1, 0), (0, 0, 1)], p['rotation']):
            if angle:
                part = part.rotate((0, 0, 0), axis, math.degrees(angle))
        part = part.translate(tuple(p['position']))
        if not part.val().isValid():
            raise ValueError(f'Invalid CAD solid: {p["id"]}')
        assembly.add(part, name=p['id'], color=cq.Color(0.72, 0.53, 0.32))
    assembly.export(str(destination))
    print(str(destination))


if __name__ == '__main__':
    p = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
    export(p, pathlib.Path(sys.argv[2]))
