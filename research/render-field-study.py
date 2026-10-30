"""Render a recorded 3D Aegir field slice; no wave simulation or interpolation in time.

Requires research/requirements.txt. Input is a completed .aegir-field.zip export.
The GIF uses the recorded physical timestamps and a fixed, clipping colour range.
"""
import argparse
from itertools import product
import json
import zipfile
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image
from matplotlib.patches import Polygon


def section(panel, uv, origin):
    """Convex panel/plane intersection from the actual CAD manifest."""
    if panel.get("footprint"):
        f = panel["footprint"]
        vertices = np.array([(x, y, z) for x, y in f["polygon"]
                             for z in (f["z"], f["z"] + f["depth"])])
    else:
        rx, ry, rz = panel["rotation"]
        cx, cy, cz = np.cos([rx, ry, rz])
        sx, sy, sz = np.sin([rx, ry, rz])
        rotation = np.array([[cz*cy, cz*sy*sx-sz*cx, cz*sy*cx+sz*sx],
                             [sz*cy, sz*sy*sx+cz*cx, sz*sy*cx-cz*sx],
                             [-sy, cy*sx, cy*cx]])
        half = np.array([panel["width"], panel["height"], panel["thickness"]]) / 2
        vertices = np.array(list(product((-1, 1), repeat=3))) * half
        vertices = vertices @ rotation.T + panel["position"]
    normal = next(i for i in range(3) if i not in uv)
    points = []
    for i, a in enumerate(vertices):
        if abs(a[normal] - origin[normal]) < 1e-7:
            points.append(tuple(a[list(uv)]))
        for b in vertices[i+1:]:
            da, db = a[normal] - origin[normal], b[normal] - origin[normal]
            if da * db < 0:
                points.append(tuple((a + da / (da - db) * (b - a))[list(uv)]))
    points = sorted(set(points))
    if len(points) < 3:
        return []
    def cross(a, b, c):
        return (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0])
    halves = []
    for sequence in (points, points[::-1]):
        hull = []
        for point in sequence:
            while len(hull) >= 2 and cross(hull[-2], hull[-1], point) <= 1e-8:
                hull.pop()
            hull.append(point)
        halves += hull[:-1]
    return halves


def render(archive: Path, output: Path, geometry: Path | None = None):
    with zipfile.ZipFile(archive) as study:
        meta = json.loads(study.read("field.json"))
        plane = meta["plane"]
        width, height = plane["width"], plane["height"]
        data = np.frombuffer(study.read("samples.f32"), dtype="<f4")
        frames = data[:len(meta["times"]) * width * height * 4].reshape(-1, height, width, 4)
        air = np.frombuffer(study.read("air-mask.u8"), dtype="u1").reshape(height, width)
    axis = plane["axis"]
    uv = {"xy": (0, 1), "xz": (0, 2), "yz": (1, 2)}[axis]
    origin = np.asarray(plane["originMm"])[list(uv)]
    pitch = plane["pitchMm"]
    extent = (origin[0] - pitch / 2, origin[0] + (width - .5) * pitch,
              origin[1] - pitch / 2, origin[1] + (height - .5) * pitch)
    limit = max(1e-6, meta["pressureScale"])
    fig, ax = plt.subplots(figsize=(6.4, 7.4), dpi=105, facecolor="#0c131b")
    fig.subplots_adjust(left=.13, right=.82, top=.84, bottom=.13)
    ax.set_facecolor("#bba27e")
    cmap = matplotlib.colormaps["RdBu_r"].copy()
    cmap.set_bad("#bba27e")
    def pressure(frame):
        return np.ma.array(frame[:, :, 0], mask=air == 0)
    image = ax.imshow(pressure(frames[0]), origin="lower", extent=extent,
                      cmap=cmap, vmin=-limit, vmax=limit, interpolation="nearest")
    if geometry:
        for panel in json.loads(geometry.read_text(encoding="utf-8"))["panels"]:
            polygon = section(panel, uv, plane["originMm"])
            if polygon:
                ax.add_patch(Polygon(polygon, closed=True, facecolor="#bba27e",
                                     edgecolor="#d7bd98", linewidth=.6))
    ax.set_xlabel(f"{'XYZ'[uv[0]]} / mm", color="#dce9ee")
    ax.set_ylabel(f"{'XYZ'[uv[1]]} / mm", color="#dce9ee")
    ax.tick_params(colors="#b5c6d0")
    for spine in ax.spines.values():
        spine.set_color("#344650")
    bar = fig.colorbar(image, ax=ax, fraction=.05, pad=.04, extend="both")
    bar.set_label("Signed pressure / Pa", color="#dce9ee")
    bar.ax.tick_params(colors="#b5c6d0")
    fig.suptitle("ÆONFORGE ÆGIR · calculated 3D waves", color="#dce9ee", fontsize=14, y=.97)
    title = ax.set_title("", color="#dce9ee", fontsize=10, pad=16)
    fig.text(.1, .04, "Recorded slice of the full 3D solve · fixed colour scale clips peaks\n"
             "Synthetic drivers · rigid walls · experimental, uncalibrated prediction",
             color="#b5c6d0", fontsize=8)
    pictures = []
    for index, frame in enumerate(frames):
        image.set_data(pressure(frame))
        title.set_text(f"{axis.upper()} slice · {meta['times'][index] * 1000:.2f} ms physical time\n"
                       f"{meta['settings']['cellMm']:g} mm grid · {meta['backend']}")
        fig.canvas.draw()
        pictures.append(Image.fromarray(np.asarray(fig.canvas.buffer_rgba()).copy()).convert("RGB"))
    output.parent.mkdir(parents=True, exist_ok=True)
    pictures[0].save(output, save_all=True, append_images=pictures[1:],
                     duration=40, loop=0, optimize=True)
    pictures[min(36, len(pictures) - 1)].save(output.with_suffix(".png"))
    plt.close(fig)
    print(f"Rendered {len(pictures)} solved frames to {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--geometry", type=Path, help="Exact exported geometry-manifest.json for wall outlines")
    args = parser.parse_args()
    render(args.archive, args.output, args.geometry)
