"""Research-only 2D linear acoustic FDTD. Not an integrated ÆGIR prediction engine.

Run with the workspace Python using the included synthetic fixture, or supply a custom
project: python research/spatial-wave-prototype.py [project.aegir.json]
Produces numerical checks, four snapshots and a pressure-field GIF under
test-results/spatial-research. Requires NumPy, Matplotlib and Pillow.

Cell-centred pressure and face-centred velocities use leapfrog time staggering.
Rigid faces block velocity. Split pressure fields implement a graded exterior
PML. One prescribed smooth volume source is used, without a coupled T/S driver.
This is a depth-averaged 2D illustration; exterior radiation differs from 3D.
"""
import json
import math
import pathlib
import sys
import time
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation, PillowWriter
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.path import Path

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'test-results' / 'spatial-research'
OUT.mkdir(parents=True, exist_ok=True)


class AcousticGrid:
    def __init__(self, air, h, c=343., rho=1.2, pml=0):
        self.air = air
        self.h, self.c, self.rho = h, c, rho
        self.bulk = rho*c*c
        self.dt = .85*h/(c*math.sqrt(2))
        ny, nx = air.shape
        self.px = np.zeros_like(air, dtype=float)
        self.py = np.zeros_like(self.px)
        self.vx = np.zeros((ny, nx+1))
        self.vy = np.zeros((ny+1, nx))
        self.face_x = air[:, :-1] & air[:, 1:]
        self.face_y = air[:-1, :] & air[1:, :]
        def damping(n):
            a = np.arange(n)+.5
            d = np.minimum(a, n-a)
            sigma = np.zeros(n)
            if pml:
                sigma = -4*c*math.log(1e-5)/(2*pml*h)*np.maximum(0, 1-d/pml)**3
            return sigma
        sx, sy = damping(nx), damping(ny)
        def coefficients(sigma):
            denominator = 1 + .5*self.dt*sigma
            return (1-.5*self.dt*sigma)/denominator, self.dt/denominator
        self.ax, self.bx = coefficients(sx[None, :])
        self.ay, self.by = coefficients(sy[:, None])
        self.avx, self.bvx = coefficients(((sx[1:]+sx[:-1])/2)[None, :])
        self.avy, self.bvy = coefficients(((sy[1:]+sy[:-1])/2)[:, None])

    @property
    def p(self):
        return self.px+self.py

    def step(self, source=None):
        p = self.p
        self.vx[:, 1:-1] = (self.avx*self.vx[:, 1:-1] - self.bvx*np.diff(p, axis=1)/(self.rho*self.h))*self.face_x
        self.vy[1:-1, :] = (self.avy*self.vy[1:-1, :] - self.bvy*np.diff(p, axis=0)/(self.rho*self.h))*self.face_y
        self.px = (self.ax*self.px - self.bx*self.bulk*np.diff(self.vx, axis=1)/self.h)*self.air
        self.py = (self.ay*self.py - self.by*self.bulk*np.diff(self.vy, axis=0)/self.h)*self.air
        if source is not None:
            self.px += .5*source
            self.py += .5*source

    def discrete_energy(self):
        # Conserved leapfrog energy at pressure time n, using velocities at n±1/2.
        p = self.p
        next_x = self.vx[:, 1:-1] - self.dt*np.diff(p, axis=1)/(self.rho*self.h)*self.face_x
        next_y = self.vy[1:-1, :] - self.dt*np.diff(p, axis=0)/(self.rho*self.h)*self.face_y
        return float((np.sum(p*p)/(2*self.bulk) + self.rho/2*(np.sum(self.vx[:, 1:-1]*next_x)+np.sum(self.vy[1:-1, :]*next_y)))*self.h*self.h)


def check_physics():
    air = np.ones((16, 80), dtype=bool)
    g = AcousticGrid(air, .01)
    g.px[:] = np.cos(np.pi*(np.arange(80)+.5)/80)
    initial = g.discrete_energy()
    values, energies = [], []
    for i in range(round(8*(2*.8/343)/g.dt)):
        g.step()
        values.append(g.p[8, 0])
        if i % 20 == 0:
            energies.append(g.discrete_energy())
    values = np.array(values)
    indices = np.flatnonzero((values[:-1] > 0) & (values[1:] <= 0))
    times = (indices+1+values[indices]/(values[indices]-values[indices+1]))*g.dt
    measured = 1/np.mean(np.diff(times))
    expected = 343/(2*.8)
    drift = max(abs(np.array(energies)/initial-1))
    assert abs(measured/expected-1) < .001, measured
    assert drift < 1e-9, drift

    g = AcousticGrid(np.ones((120, 200), dtype=bool), .01, pml=20)
    yy, xx = np.mgrid[:120, :200]
    g.px[:] = np.exp(-((xx-100)**2+(yy-60)**2)/18)
    initial = np.sum(g.p*g.p)/(2*g.bulk)
    for _ in range(1600):
        g.step()
    remaining = (np.sum(g.p*g.p)/(2*g.bulk)+g.rho/2*(np.sum(g.vx*g.vx)+np.sum(g.vy*g.vy)))/initial
    assert remaining < .001, remaining
    yy, xx = np.mgrid[:48, :64]
    a = np.exp(-((xx-14)**2+(yy-23.5)**2)/18)
    b = np.exp(-((xx-49)**2+(yy-23.5)**2)/18)
    grids = [AcousticGrid(np.ones((48, 64), dtype=bool), .01) for _ in range(4)]
    for grid, initial_field in zip(grids, [a, b, a+b, a-b]):
        grid.px[:] = initial_field
    superposition_error, opposite_node, same_phase_peak = 0., 0., 0.
    for _ in range(400):
        for grid in grids:
            grid.step()
        p_a, p_b, p_sum, p_difference = [grid.p for grid in grids]
        superposition_error = max(superposition_error, float(np.max(abs(p_sum-p_a-p_b))))
        opposite_node = max(opposite_node, float(np.max(abs((p_difference[:, 31]+p_difference[:, 32])/2))))
        same_phase_peak = max(same_phase_peak, float(np.max(abs((p_sum[:, 31]+p_sum[:, 32])/2))))
    assert superposition_error < 1e-11 and opposite_node < 1e-11 and same_phase_peak > .01
    return {'rigid_tube_frequency_hz': measured, 'analytic_frequency_hz': expected,
            'relative_frequency_error': abs(measured/expected-1),
            'rigid_closed_grid_max_energy_drift': drift,
            'pml_test_remaining_energy_fraction': float(remaining),
            'two_source_superposition_max_error': superposition_error,
            'opposite_phase_symmetry_plane_peak': opposite_node,
            'same_phase_symmetry_plane_peak': same_phase_peak,
            'limits': 'PML energy decay is a screening check, not an oblique/low-frequency reflection coefficient bound.'}


def cabinet(project, h=.006, pad=.18):
    layout, thickness = project['layout'], project['design']['thickness']/1000
    w, height, depth = [layout[k]/1000 for k in ('width', 'height', 'depth')]
    nx, ny = math.ceil((w+2*pad)/h), math.ceil((height+2*pad)/h)
    # Exactly square cells; domain padding includes the final partial outer extent.
    x, y = (np.arange(nx)+.5)*h-pad, (np.arange(ny)+.5)*h-pad
    xx, yy = np.meshgrid(x, y)
    outer = (xx >= 0) & (xx <= w) & (yy >= 0) & (yy <= height)
    inner = (xx >= thickness) & (xx <= w-thickness) & (yy >= thickness) & (yy <= height-thickness)
    solid = outer & ~inner
    mouth = layout['mouth']
    centre, half = mouth['offset']/1000+thickness, mouth['width']/2000
    if mouth['side'] in ('top', 'bottom'):
        opening = (abs(xx-centre) < half) & ((yy >= height-thickness) if mouth['side'] == 'top' else (yy <= thickness))
    else:
        opening = (abs(yy-centre) < half) & ((xx >= w-thickness) if mouth['side'] == 'right' else (xx <= thickness))
    solid[opening & outer] = False
    points = np.column_stack([xx.ravel(), yy.ravel()])
    for b in layout['baffles']:
        a, end = np.array(b['start'])/1000+thickness, np.array(b['end'])/1000+thickness
        delta = end-a
        normal = np.array([-delta[1], delta[0]])/np.linalg.norm(delta)*b.get('thickness', thickness*1000)/2000
        polygon = [a+normal, end+normal, end-normal, a-normal, a+normal]
        solid |= Path(polygon).contains_points(points).reshape(xx.shape) & inner
    mount = (project.get('mounts') or [{'position': project['design']['driverPosition']}])[0]
    route = np.array(layout['route'])/1000+thickness
    lengths = np.linalg.norm(np.diff(route, axis=0), axis=1)
    travel = sum(lengths)*mount['position']
    source_position = route[-1]
    for a, end, length in zip(route[:-1], route[1:], lengths):
        if travel <= length:
            source_position = a+(end-a)*travel/length
            break
        travel -= length
    source = np.exp(-((xx-source_position[0])**2+(yy-source_position[1])**2)/(2*(2*h)**2))*(~solid)
    source /= source.sum()
    return ~solid, source, source_position, h, [x[0]-h/2, x[-1]+h/2, y[0]-h/2, y[-1]+h/2], depth-2*thickness


def main():
    checks = check_physics()
    if len(sys.argv) > 1:
        project = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
    else:
        project = json.loads((ROOT/'research/tapered-fold.aegir.json').read_text(encoding='utf-8'))
    if 'layout' not in project:
        raise ValueError('Supply a custom-layout project; the MCP acceptance example is the default.')
    air, source, position, h, extent, depth = cabinet(project)
    g = AcousticGrid(air, h, pml=20)
    frequency, duration = 700., .026
    frames, times = [], []
    start = time.perf_counter()
    for i in range(math.ceil(duration/g.dt)):
        t = (i+.5)*g.dt
        argument = math.pi*frequency*(t-1.5/frequency)
        q = 1e-5*(1-2*argument*argument)*math.exp(-argument*argument)
        g.step(g.dt*g.bulk*q/(h*h*depth)*source)
        if i % 25 == 0:
            frames.append(g.p.astype(np.float32))
            times.append((i+1)*g.dt)
    seconds = time.perf_counter()-start
    fields = np.array(frames)
    scale = float(np.quantile(abs(fields), .998))
    relative = fields/max(scale, 1e-12)
    palette = LinearSegmentedColormap.from_list('aegir-pressure', ['#79c7ee', '#0c1720', '#efad91'])
    palette.set_bad('#bfaa89')
    plt.rcParams.update({'figure.facecolor': '#0b1117', 'axes.facecolor': '#0b1117', 'text.color': '#dce6ec', 'axes.labelcolor': '#a2b8c5', 'xtick.color': '#a2b8c5', 'ytick.color': '#a2b8c5', 'font.size': 9})
    mm = np.array(extent)*1000

    def paint(ax, index):
        image = ax.imshow(np.ma.array(relative[index], mask=~air), origin='lower', extent=mm, cmap=palette, vmin=-1, vmax=1, interpolation='nearest')
        ax.plot(position[0]*1000, position[1]*1000, 'o', markerfacecolor='none', markeredgecolor='#f3e9db', markersize=10)
        ax.set_xlabel('x / mm')
        ax.set_ylabel('y / mm')
        ax.set_title(f'{times[index]*1000:.2f} ms physical time')
        return image

    fig, axes = plt.subplots(1, 4, figsize=(12, 6), constrained_layout=True)
    for ax, target in zip(axes, [2.5, 5., 8., 12.]):
        image = paint(ax, int(np.argmin(abs(np.array(times)*1000-target))))
    fig.suptitle('ÆGIR · numerical wave-field research\n2D depth-averaged air + exterior PML · rigid boards · prescribed 700 Hz pulse')
    fig.colorbar(image, ax=axes, shrink=.6, label='relative signed pressure · fixed scale · near-source values clipped')
    fig.savefig(OUT/'pressure-snapshots.png', dpi=150)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(5.2, 7.3), constrained_layout=True)
    image = paint(ax, 0)
    fig.suptitle('ÆGIR · wave-equation prototype\n2D illustration · primary source only · no stuffing')
    fig.colorbar(image, ax=ax, shrink=.5, label='relative signed pressure')
    fig.text(.5, .005, 'Fixed colour scale; no calibrated SPL or 3D radiation prediction.', ha='center', fontsize=8)
    def update(index):
        image.set_data(np.ma.array(relative[index], mask=~air))
        ax.set_title(f'{times[index]*1000:.2f} ms physical time · 700 Hz pulse')
        return image,
    animation = FuncAnimation(fig, update, frames=len(times), interval=85, blit=False)
    animation.save(OUT/'pressure-wave.gif', writer=PillowWriter(fps=12), dpi=100)
    plt.close(fig)
    evidence = {'checks': checks, 'project': project, 'grid': list(air.shape), 'cell_mm': h*1000,
                'time_step_seconds': g.dt, 'physical_duration_seconds': duration, 'cpu_solver_seconds': seconds,
                'frames': len(frames), 'source_centre_hz': frequency,
                'limitations': ['Research prototype only; not integrated with app or MCP.', 'Depth-averaged 2D; exterior spreading differs from 3D.', 'Prescribed primary volume source; no T/S feedback or secondary-source drive.', 'Rigid walls and no stuffing; voxel staircasing has not undergone cabinet mesh-convergence validation.', 'Fixed normalized pressure colour scale; near-source values clipped.']}
    (OUT/'evidence.json').write_text(json.dumps(evidence, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in evidence.items() if k not in ('project', 'limitations')}, indent=2))
    print(str(OUT/'pressure-wave.gif'))


if __name__ == '__main__':
    main()
