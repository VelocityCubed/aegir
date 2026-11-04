# ÆGIR engineering report: MJK Satori TL · loss, stuffing and observation study

Project revision 10.

Cabinet: 279.40 × 958.85 × 342.90 mm. Route 1.8097 m; cavity 72.77 L; 7 panels; 2 source(s).

Band 30–200 Hz at 2.83 V RMS: mean 74.36 dB, ripple 9.87 dB, F3 37.63 Hz. Sweep peaks: excursion 3.297 mm, mouth velocity 0.624 m/s.

## Driver headroom (target band)

- primary: 1.535 mm peak / 8.5 mm Xmax (18.1%).
- tweeter: 0.001 mm peak / 0.25 mm Xmax (0.4%).

Impedance convention: common-parallel-input.

## Panel stock schedule

```csv
part,width_mm,height_mm,thickness_mm,quantity
"Front baffle",279.4,958.85,12.7,1
"Back panel",279.4,958.85,12.7,1
"left wall",317.5,958.85,12.7,1
"right wall",317.5,958.85,12.7,1
"top cap",254,317.5,12.7,1
"bottom cap",254,317.5,12.7,1
"Published single-fold divider · 83.9 degrees",254,777.73246,12.7,1
```

## Model and machining limits

- The 1D line estimate assumes one dominant full-depth XY route. Free 3D boards, isolated chambers and spatial modes require a 3D study.



Linear equivalent 1D model. Observation: {"positionMm":[114.3,850.9,-3000],"space":"half-space","baffle":"sphere-transition","baffleRadiusMm":139.7}.

- Separate source/microphone coordinates, propagation phase and circular-piston directivity. No cabinet shadowing, rectangular-edge diffraction, cone breakup or room reflections; full-speaker response remains provisional.
- Circular piston radiation impedance uses full Bessel/Struve integrals. Equivalent-circle mouth and rigid-piston assumptions remain; a1D line still lacks transverse modes.
- Equivalent-sphere baffle-step transition is a selectable approximation, not a rectangular-baffle diffraction solution.
- Empty-line loss uses King2003 empirical tube resistance10Pa·s/m². It has not been verified as the2023 worksheet law.
- Acoustic equivalent profile (digitized), independent of the CAD cavity: Martin J. King, The Two-Year Transmission Line Speaker Design, 2023-09-23; http://quarter-wave.com/Project13/Satori_TL_Design_Documentation.pdf; Fig 8 raster digitization: 0.5in sample, estimated area uncertainty ±0.03×2Sd; not exact MathCad input. The acoustic profile includes corner volumes unlike the CAD cavity.
- Stuffing region0–0.75: mjk-2003; calibration=assumed; King 2023 Satori:0.5lb/ft3 over first~3/4 length; King2003 damping correlation is an assumed transfer to this material/design, not a verified2023 fit.
- Legacy section attenuation remains empirical Np/m. Material models replace gas propagation inside their regions; density is not converted to JCAL transport parameters.

Not physical validation, room prediction, nonlinear distortion or a CNC toolpath. Use prototype measurements before committing a final design.

## Published-reference comparisons

```json
{
  "scope": "Reference comparisons do not constitute validation of a complete loudspeaker.",
  "project": {
    "version": 1,
    "name": "MJK Satori TL · loss, stuffing and observation study",
    "driver": {
      "id": "satori-wo24p4-mjk-consistent-2023",
      "name": "Satori WO24P-4 · King's measured set",
      "note": "SOURCE: MJK Fig6 consistent set: Fs32.81 Qes.545 Qms7.637 Vas48.31 Re3.3 Sd255 Le.3721mH Rp.740ohm Lp.5948mH. Xmax8.5mm derived from17mm p-p; cutout210.185mm from plan. Frame242mm and overall depth131.4mm from manufacturer; depth retained conservatively as rear clearance. This two-way model includes the sealed-back TW29R and the Fig18 crossover.",
      "fs": 32.81,
      "qes": 0.545,
      "qms": 7.637,
      "vas": 48.31,
      "re": 3.3,
      "le": 0.3721,
      "sd": 255,
      "xmax": 8.5,
      "cutout": 210.185,
      "frame": 242,
      "depth": 131.4,
      "lossyInductance": {
        "resistance": 0.74,
        "inductance": 0.5948
      }
    },
    "design": {
      "length": 1.85928,
      "areaRatio": 2.53,
      "laneWidth": 254,
      "folds": 2,
      "thickness": 12.7,
      "driverPosition": 0.345,
      "damping": 0,
      "voltage": 2.83,
      "temperature": 20
    },
    "targets": {
      "low": 30,
      "high": 200,
      "maxHeight": 1000,
      "maxWidth": 300,
      "maxDepth": 370,
      "minLength": 1.5,
      "maxLength": 2.3,
      "maxVelocity": 17
    },
    "layout": {
      "width": 279.4,
      "height": 958.85,
      "depth": 342.9,
      "baffles": [
        {
          "id": "tapered-divider",
          "label": "Published single-fold divider · 83.9 degrees",
          "start": [
            0,
            0
          ],
          "end": [
            0,
            774.7
          ],
          "thickness": 12.7,
          "pose": {
            "center": [
              139.7,
              400.05,
              231.81074633265817
            ],
            "size": [
              254,
              777.7324627417753
            ],
            "rotation": [
              -0.10615680151263622,
              0,
              0
            ]
          }
        }
      ],
      "route": [
        [
          139.7,
          0
        ],
        [
          139.7,
          933.45
        ],
        [
          139.7,
          57.15
        ]
      ],
      "mouth": {
        "side": "back",
        "center": [
          127,
          57.15
        ],
        "height": 63.5,
        "offset": 57.15,
        "width": 203.2
      }
    },
    "mounts": [
      {
        "id": "primary",
        "driver": {
          "id": "satori-wo24p4-mjk-consistent-2023",
          "name": "Satori WO24P-4 · King's measured set",
          "note": "SOURCE: MJK Fig6 consistent set: Fs32.81 Qes.545 Qms7.637 Vas48.31 Re3.3 Sd255 Le.3721mH Rp.740ohm Lp.5948mH. Xmax8.5mm derived from17mm p-p; cutout210.185mm from plan. Frame242mm and overall depth131.4mm from manufacturer; depth retained conservatively as rear clearance. This two-way model includes the sealed-back TW29R and the Fig18 crossover.",
          "fs": 32.81,
          "qes": 0.545,
          "qms": 7.637,
          "vas": 48.31,
          "re": 3.3,
          "le": 0.3721,
          "sd": 255,
          "xmax": 8.5,
          "cutout": 210.185,
          "frame": 242,
          "depth": 131.4,
          "lossyInductance": {
            "resistance": 0.74,
            "inductance": 0.5948
          }
        },
        "position": 0.345,
        "face": "front",
        "at": [
          139.7,
          647.7
        ],
        "voltageScale": 1,
        "phase": 0,
        "rearLoading": "cabinet",
        "crossover": {
          "passive": [
            {
              "connection": "series",
              "kind": "L",
              "value": 0.0035,
              "resistance": 0.81
            },
            {
              "connection": "shunt",
              "kind": "C",
              "value": 0.000036
            }
          ]
        }
      },
      {
        "id": "tweeter",
        "driver": {
          "id": "satori-tw29r-consistent",
          "name": "Satori TW29R · Fig 6 consistent",
          "note": "SOURCE: MJK Fig 6 consistent T/S set. Le interpreted as 0.017 mH (table unit ambiguity); loss branch omitted pending clarification. Dimensions SB TW29R Rev1: overall depth37.3 minus5mm flange =32.3 behind baffle. Xmax0.25mm derived from0.5mm p-p.",
          "fs": 671.7,
          "qes": 1.375,
          "qms": 2.214,
          "vas": 0.022,
          "re": 3.05,
          "le": 0.017,
          "sd": 9.6,
          "xmax": 0.25,
          "cutout": 71.12,
          "frame": 103.8,
          "depth": 32.3
        },
        "position": 0.345,
        "face": "front",
        "at": [
          114.3,
          850.9
        ],
        "voltageScale": 1,
        "phase": 0,
        "rearLoading": "sealed-back",
        "crossover": {
          "passive": [
            {
              "connection": "series",
              "kind": "C",
              "value": 0.000018
            },
            {
              "connection": "shunt",
              "kind": "L",
              "value": 0.00033,
              "resistance": 0.1
            },
            {
              "connection": "series",
              "kind": "R",
              "value": 2.5
            },
            {
              "connection": "shunt",
              "kind": "R",
              "value": 1.5
            }
          ]
        }
      }
    ],
    "system": {
      "physics": {
        "ductLoss": "mjk-2003",
        "radiation": "piston",
        "stuffing": [
          {
            "start": 0,
            "end": 0.75,
            "source": "King 2023 Satori:0.5lb/ft3 over first~3/4 length; King2003 damping correlation is an assumed transfer to this material/design, not a verified2023 fit.",
            "calibration": "assumed",
            "material": {
              "model": "mjk-2003",
              "densityKgM3": 8.0092317
            }
          }
        ]
      },
      "observation": {
        "positionMm": [
          114.3,
          850.9,
          -3000
        ],
        "space": "half-space",
        "baffle": "sphere-transition",
        "baffleRadiusMm": 139.7
      },
      "profile": {
        "source": "Martin J. King, The Two-Year Transmission Line Speaker Design, 2023-09-23; http://quarter-wave.com/Project13/Satori_TL_Design_Documentation.pdf; Fig 8 raster digitization: 0.5in sample, estimated area uncertainty ±0.03×2Sd; not exact MathCad input. The acoustic profile includes corner volumes unlike the CAD cavity.",
        "evidence": "digitized",
        "sections": [
          {
            "distance": 0,
            "area": 64172.19,
            "width": 252.64642,
            "damping": 0
          },
          {
            "distance": 0.0127,
            "area": 64172.19,
            "width": 252.64642,
            "damping": 0
          },
          {
            "distance": 0.0254,
            "area": 64172.19,
            "width": 252.64642,
            "damping": 0
          },
          {
            "distance": 0.0381,
            "area": 63496.69,
            "width": 249.98697,
            "damping": 0
          },
          {
            "distance": 0.0508,
            "area": 62483.44,
            "width": 245.9978,
            "damping": 0
          },
          {
            "distance": 0.0635,
            "area": 62483.44,
            "width": 245.9978,
            "damping": 0
          },
          {
            "distance": 0.0762,
            "area": 62145.7,
            "width": 244.66811,
            "damping": 0
          },
          {
            "distance": 0.0889,
            "area": 61807.95,
            "width": 243.33839,
            "damping": 0
          },
          {
            "distance": 0.1016,
            "area": 61807.95,
            "width": 243.33839,
            "damping": 0
          },
          {
            "distance": 0.1143,
            "area": 61132.45,
            "width": 240.67894,
            "damping": 0
          },
          {
            "distance": 0.127,
            "area": 60456.95,
            "width": 238.01949,
            "damping": 0
          },
          {
            "distance": 0.1397,
            "area": 59781.46,
            "width": 235.36008,
            "damping": 0
          },
          {
            "distance": 0.1524,
            "area": 60119.21,
            "width": 236.6898,
            "damping": 0
          },
          {
            "distance": 0.1651,
            "area": 59105.96,
            "width": 232.70063,
            "damping": 0
          },
          {
            "distance": 0.1778,
            "area": 59105.96,
            "width": 232.70063,
            "damping": 0
          },
          {
            "distance": 0.1905,
            "area": 59105.96,
            "width": 232.70063,
            "damping": 0
          },
          {
            "distance": 0.2032,
            "area": 58768.21,
            "width": 231.37091,
            "damping": 0
          },
          {
            "distance": 0.2159,
            "area": 57754.97,
            "width": 227.38177,
            "damping": 0
          },
          {
            "distance": 0.2286,
            "area": 57754.97,
            "width": 227.38177,
            "damping": 0
          },
          {
            "distance": 0.2413,
            "area": 57754.97,
            "width": 227.38177,
            "damping": 0
          },
          {
            "distance": 0.254,
            "area": 57754.97,
            "width": 227.38177,
            "damping": 0
          },
          {
            "distance": 0.2667,
            "area": 57079.47,
            "width": 224.72232,
            "damping": 0
          },
          {
            "distance": 0.2794,
            "area": 56741.72,
            "width": 223.3926,
            "damping": 0
          },
          {
            "distance": 0.2921,
            "area": 56066.23,
            "width": 220.73319,
            "damping": 0
          },
          {
            "distance": 0.3048,
            "area": 57754.97,
            "width": 227.38177,
            "damping": 0
          },
          {
            "distance": 0.3175,
            "area": 56066.23,
            "width": 220.73319,
            "damping": 0
          },
          {
            "distance": 0.3302,
            "area": 55728.48,
            "width": 219.40346,
            "damping": 0
          },
          {
            "distance": 0.3429,
            "area": 55728.48,
            "width": 219.40346,
            "damping": 0
          },
          {
            "distance": 0.3556,
            "area": 54715.23,
            "width": 215.41429,
            "damping": 0
          },
          {
            "distance": 0.3683,
            "area": 54377.48,
            "width": 214.08457,
            "damping": 0
          },
          {
            "distance": 0.381,
            "area": 54377.48,
            "width": 214.08457,
            "damping": 0
          },
          {
            "distance": 0.3937,
            "area": 54039.74,
            "width": 212.75488,
            "damping": 0
          },
          {
            "distance": 0.4064,
            "area": 53364.24,
            "width": 210.09543,
            "damping": 0
          },
          {
            "distance": 0.4191,
            "area": 53026.49,
            "width": 208.76571,
            "damping": 0
          },
          {
            "distance": 0.4318,
            "area": 52350.99,
            "width": 206.10626,
            "damping": 0
          },
          {
            "distance": 0.4445,
            "area": 51675.5,
            "width": 203.44685,
            "damping": 0
          },
          {
            "distance": 0.4572,
            "area": 51337.75,
            "width": 202.11713,
            "damping": 0
          },
          {
            "distance": 0.4699,
            "area": 51337.75,
            "width": 202.11713,
            "damping": 0
          },
          {
            "distance": 0.4826,
            "area": 49649.01,
            "width": 195.46854,
            "damping": 0
          },
          {
            "distance": 0.4953,
            "area": 51000,
            "width": 200.7874,
            "damping": 0
          },
          {
            "distance": 0.508,
            "area": 50662.25,
            "width": 199.45768,
            "damping": 0
          },
          {
            "distance": 0.5207,
            "area": 49986.75,
            "width": 196.79823,
            "damping": 0
          },
          {
            "distance": 0.5334,
            "area": 49311.26,
            "width": 194.13882,
            "damping": 0
          },
          {
            "distance": 0.5461,
            "area": 48973.51,
            "width": 192.80909,
            "damping": 0
          },
          {
            "distance": 0.5588,
            "area": 48973.51,
            "width": 192.80909,
            "damping": 0
          },
          {
            "distance": 0.5715,
            "area": 48973.51,
            "width": 192.80909,
            "damping": 0
          },
          {
            "distance": 0.5842,
            "area": 48635.76,
            "width": 191.47937,
            "damping": 0
          },
          {
            "distance": 0.5969,
            "area": 48298.01,
            "width": 190.14965,
            "damping": 0
          },
          {
            "distance": 0.6096,
            "area": 47622.52,
            "width": 187.49024,
            "damping": 0
          },
          {
            "distance": 0.6223,
            "area": 47960.26,
            "width": 188.81992,
            "damping": 0
          },
          {
            "distance": 0.635,
            "area": 47622.52,
            "width": 187.49024,
            "damping": 0
          },
          {
            "distance": 0.6477,
            "area": 47622.52,
            "width": 187.49024,
            "damping": 0
          },
          {
            "distance": 0.6604,
            "area": 46947.02,
            "width": 184.83079,
            "damping": 0
          },
          {
            "distance": 0.6731,
            "area": 46271.52,
            "width": 182.17134,
            "damping": 0
          },
          {
            "distance": 0.6858,
            "area": 44920.53,
            "width": 176.85248,
            "damping": 0
          },
          {
            "distance": 0.6985,
            "area": 45596.03,
            "width": 179.51193,
            "damping": 0
          },
          {
            "distance": 0.7112,
            "area": 44245.03,
            "width": 174.19303,
            "damping": 0
          },
          {
            "distance": 0.7239,
            "area": 44920.53,
            "width": 176.85248,
            "damping": 0
          },
          {
            "distance": 0.7366,
            "area": 43907.28,
            "width": 172.86331,
            "damping": 0
          },
          {
            "distance": 0.7493,
            "area": 42894.04,
            "width": 168.87417,
            "damping": 0
          },
          {
            "distance": 0.762,
            "area": 42894.04,
            "width": 168.87417,
            "damping": 0
          },
          {
            "distance": 0.7747,
            "area": 44245.03,
            "width": 174.19303,
            "damping": 0
          },
          {
            "distance": 0.7874,
            "area": 44245.03,
            "width": 174.19303,
            "damping": 0
          },
          {
            "distance": 0.8001,
            "area": 47284.77,
            "width": 186.16051,
            "damping": 0
          },
          {
            "distance": 0.8128,
            "area": 51337.75,
            "width": 202.11713,
            "damping": 0
          },
          {
            "distance": 0.8255,
            "area": 53364.24,
            "width": 210.09543,
            "damping": 0
          },
          {
            "distance": 0.8382,
            "area": 57417.22,
            "width": 226.05205,
            "damping": 0
          },
          {
            "distance": 0.8509,
            "area": 58430.46,
            "width": 230.04118,
            "damping": 0
          },
          {
            "distance": 0.8636,
            "area": 57754.97,
            "width": 227.38177,
            "damping": 0
          },
          {
            "distance": 0.8763,
            "area": 55052.98,
            "width": 216.74402,
            "damping": 0
          },
          {
            "distance": 0.889,
            "area": 51000,
            "width": 200.7874,
            "damping": 0
          },
          {
            "distance": 0.9017,
            "area": 48298.01,
            "width": 190.14965,
            "damping": 0
          },
          {
            "distance": 0.9144,
            "area": 42218.54,
            "width": 166.21472,
            "damping": 0
          },
          {
            "distance": 0.9271,
            "area": 40529.8,
            "width": 159.56614,
            "damping": 0
          },
          {
            "distance": 0.9398,
            "area": 40192.05,
            "width": 158.23642,
            "damping": 0
          },
          {
            "distance": 0.9525,
            "area": 40192.05,
            "width": 158.23642,
            "damping": 0
          },
          {
            "distance": 0.9652,
            "area": 41543.05,
            "width": 163.55531,
            "damping": 0
          },
          {
            "distance": 0.9779,
            "area": 45596.03,
            "width": 179.51193,
            "damping": 0
          },
          {
            "distance": 0.9906,
            "area": 48298.01,
            "width": 190.14965,
            "damping": 0
          },
          {
            "distance": 1.0033,
            "area": 52350.99,
            "width": 206.10626,
            "damping": 0
          },
          {
            "distance": 1.016,
            "area": 51675.5,
            "width": 203.44685,
            "damping": 0
          },
          {
            "distance": 1.0287,
            "area": 51675.5,
            "width": 203.44685,
            "damping": 0
          },
          {
            "distance": 1.0414,
            "area": 50662.25,
            "width": 199.45768,
            "damping": 0
          },
          {
            "distance": 1.0541,
            "area": 44920.53,
            "width": 176.85248,
            "damping": 0
          },
          {
            "distance": 1.0668,
            "area": 41543.05,
            "width": 163.55531,
            "damping": 0
          },
          {
            "distance": 1.0795,
            "area": 35463.58,
            "width": 139.62039,
            "damping": 0
          },
          {
            "distance": 1.0922,
            "area": 35125.83,
            "width": 138.29067,
            "damping": 0
          },
          {
            "distance": 1.1049,
            "area": 33437.09,
            "width": 131.64209,
            "damping": 0
          },
          {
            "distance": 1.1176,
            "area": 34112.58,
            "width": 134.3015,
            "damping": 0
          },
          {
            "distance": 1.1303,
            "area": 33437.09,
            "width": 131.64209,
            "damping": 0
          },
          {
            "distance": 1.143,
            "area": 32761.59,
            "width": 128.98264,
            "damping": 0
          },
          {
            "distance": 1.1557,
            "area": 32086.09,
            "width": 126.32319,
            "damping": 0
          },
          {
            "distance": 1.1684,
            "area": 32086.09,
            "width": 126.32319,
            "damping": 0
          },
          {
            "distance": 1.1811,
            "area": 31748.34,
            "width": 124.99346,
            "damping": 0
          },
          {
            "distance": 1.1938,
            "area": 30735.1,
            "width": 121.00433,
            "damping": 0
          },
          {
            "distance": 1.2065,
            "area": 31072.85,
            "width": 122.33406,
            "damping": 0
          },
          {
            "distance": 1.2192,
            "area": 30735.1,
            "width": 121.00433,
            "damping": 0
          },
          {
            "distance": 1.2319,
            "area": 30397.35,
            "width": 119.67461,
            "damping": 0
          },
          {
            "distance": 1.2446,
            "area": 29721.85,
            "width": 117.01516,
            "damping": 0
          },
          {
            "distance": 1.2573,
            "area": 30059.6,
            "width": 118.34488,
            "damping": 0
          },
          {
            "distance": 1.27,
            "area": 29384.11,
            "width": 115.68547,
            "damping": 0
          },
          {
            "distance": 1.2827,
            "area": 29046.36,
            "width": 114.35575,
            "damping": 0
          },
          {
            "distance": 1.2954,
            "area": 29384.11,
            "width": 115.68547,
            "damping": 0
          },
          {
            "distance": 1.3081,
            "area": 28708.61,
            "width": 113.02602,
            "damping": 0
          },
          {
            "distance": 1.3208,
            "area": 28708.61,
            "width": 113.02602,
            "damping": 0
          },
          {
            "distance": 1.3335,
            "area": 27695.36,
            "width": 109.03685,
            "damping": 0
          },
          {
            "distance": 1.3462,
            "area": 27357.62,
            "width": 107.70717,
            "damping": 0
          },
          {
            "distance": 1.3589,
            "area": 27357.62,
            "width": 107.70717,
            "damping": 0
          },
          {
            "distance": 1.3716,
            "area": 27357.62,
            "width": 107.70717,
            "damping": 0
          },
          {
            "distance": 1.3843,
            "area": 27019.87,
            "width": 106.37744,
            "damping": 0
          },
          {
            "distance": 1.397,
            "area": 26006.62,
            "width": 102.38827,
            "damping": 0
          },
          {
            "distance": 1.4097,
            "area": 26006.62,
            "width": 102.38827,
            "damping": 0
          },
          {
            "distance": 1.4224,
            "area": 26006.62,
            "width": 102.38827,
            "damping": 0
          },
          {
            "distance": 1.4351,
            "area": 26006.62,
            "width": 102.38827,
            "damping": 0
          },
          {
            "distance": 1.4478,
            "area": 24993.38,
            "width": 98.39913,
            "damping": 0
          },
          {
            "distance": 1.4605,
            "area": 25331.13,
            "width": 99.72886,
            "damping": 0
          },
          {
            "distance": 1.4732,
            "area": 24993.38,
            "width": 98.39913,
            "damping": 0
          },
          {
            "distance": 1.4859,
            "area": 24317.88,
            "width": 95.73969,
            "damping": 0
          },
          {
            "distance": 1.4986,
            "area": 23642.38,
            "width": 93.08024,
            "damping": 0
          },
          {
            "distance": 1.5113,
            "area": 23304.64,
            "width": 91.75055,
            "damping": 0
          },
          {
            "distance": 1.524,
            "area": 22629.14,
            "width": 89.0911,
            "damping": 0
          },
          {
            "distance": 1.5367,
            "area": 22629.14,
            "width": 89.0911,
            "damping": 0
          },
          {
            "distance": 1.5494,
            "area": 22629.14,
            "width": 89.0911,
            "damping": 0
          },
          {
            "distance": 1.5621,
            "area": 22629.14,
            "width": 89.0911,
            "damping": 0
          },
          {
            "distance": 1.5748,
            "area": 21615.89,
            "width": 85.10193,
            "damping": 0
          },
          {
            "distance": 1.5875,
            "area": 20602.65,
            "width": 81.1128,
            "damping": 0
          },
          {
            "distance": 1.6002,
            "area": 21615.89,
            "width": 85.10193,
            "damping": 0
          },
          {
            "distance": 1.6129,
            "area": 20264.9,
            "width": 79.78307,
            "damping": 0
          },
          {
            "distance": 1.6256,
            "area": 19589.4,
            "width": 77.12362,
            "damping": 0
          },
          {
            "distance": 1.6383,
            "area": 20264.9,
            "width": 79.78307,
            "damping": 0
          },
          {
            "distance": 1.651,
            "area": 19589.4,
            "width": 77.12362,
            "damping": 0
          },
          {
            "distance": 1.6637,
            "area": 18913.91,
            "width": 74.46421,
            "damping": 0
          },
          {
            "distance": 1.6764,
            "area": 18576.16,
            "width": 73.13449,
            "damping": 0
          },
          {
            "distance": 1.6891,
            "area": 18576.16,
            "width": 73.13449,
            "damping": 0
          },
          {
            "distance": 1.7018,
            "area": 17562.91,
            "width": 69.14531,
            "damping": 0
          },
          {
            "distance": 1.7145,
            "area": 17562.91,
            "width": 69.14531,
            "damping": 0
          },
          {
            "distance": 1.7272,
            "area": 17562.91,
            "width": 69.14531,
            "damping": 0
          },
          {
            "distance": 1.7399,
            "area": 17225.17,
            "width": 67.81563,
            "damping": 0
          },
          {
            "distance": 1.7526,
            "area": 16549.67,
            "width": 65.15618,
            "damping": 0
          },
          {
            "distance": 1.7653,
            "area": 15874.17,
            "width": 62.49673,
            "damping": 0
          },
          {
            "distance": 1.778,
            "area": 17562.91,
            "width": 69.14531,
            "damping": 0
          },
          {
            "distance": 1.7907,
            "area": 18238.41,
            "width": 71.80476,
            "damping": 0
          },
          {
            "distance": 1.8034,
            "area": 16549.67,
            "width": 65.15618,
            "damping": 0
          },
          {
            "distance": 1.8161,
            "area": 19589.4,
            "width": 77.12362,
            "damping": 0
          },
          {
            "distance": 1.8288,
            "area": 14860.93,
            "width": 58.5076,
            "damping": 0
          },
          {
            "distance": 1.8415,
            "area": 15536.42,
            "width": 61.16701,
            "damping": 0
          },
          {
            "distance": 1.8542,
            "area": 15198.68,
            "width": 59.83732,
            "damping": 0
          },
          {
            "distance": 1.85928,
            "area": 14523.18,
            "width": 57.17787,
            "damping": 0
          }
        ],
        "mouthArea": 12903.199999999999
      },
      "sweep": [
        10,
        20000
      ],
      "distanceM": 3,
      "references": [
        {
          "id": "fig18-total",
          "title": "Fig 18 passive anechoic sum at 3 m (approximate raster)",
          "source": "Martin J. King, The Two-Year Transmission Line Speaker Design, 2023-09-23; http://quarter-wave.com/Project13/Satori_TL_Design_Documentation.pdf; Fig 18 passive anechoic sum at 3 m (approximate raster)",
          "evidence": "published-simulation",
          "metric": "spl",
          "conditions": {
            "voltage": null,
            "distanceM": 3,
            "radiation": "anechoic",
            "stuffing": "stuffed",
            "crossover": "passive",
            "notes": "The paper text does not explicitly identify input voltage for this graph. Local drive2.83Vrms is ASSUMED, not a verified published test condition.",
            "microphoneMm": [
              114.3,
              850.9,
              -3000
            ]
          },
          "tolerance": 2,
          "uncertainty": 0.6,
          "samples": [
            [
              10,
              41.025
            ],
            [
              15,
              53.525
            ],
            [
              20,
              61.926
            ],
            [
              30,
              70.123
            ],
            [
              40,
              74.016
            ],
            [
              50,
              76.27
            ],
            [
              70,
              77.09
            ],
            [
              100,
              76.27
            ],
            [
              150,
              74.426
            ],
            [
              200,
              75.246
            ],
            [
              300,
              75.451
            ],
            [
              500,
              74.016
            ],
            [
              700,
              73.811
            ],
            [
              1000,
              73.197
            ],
            [
              1500,
              72.787
            ],
            [
              2000,
              72.172
            ],
            [
              3000,
              72.582
            ],
            [
              7000,
              72.582
            ]
          ]
        },
        {
          "id": "fig15-solid-z",
          "title": "Figure15 empty TL calculated solid impedance (approximate embedded-raster extraction)",
          "source": "Martin J. King, 2023-09-23 Satori TL report, Figure15; original embedded586x293 JPEG; scripts/extract-satori-impedance.py",
          "evidence": "published-simulation",
          "trace": "calculated-solid",
          "frequencyUncertaintyPercent": 2,
          "metric": "impedance",
          "conditions": {
            "voltage": null,
            "distanceM": null,
            "radiation": "near-field",
            "stuffing": "empty",
            "crossover": "bypass",
            "notes": "Approximate solid-curve extraction using contiguous red strokes. Dashed measured curve is separate and is not used as a calculated target. Inspect extraction overlay; dense raster samples are correlated."
          },
          "tolerance": 2,
          "uncertainty": 1,
          "samples": [
            [
              10.09701,
              4.555
            ],
            [
              10.29387,
              4.555
            ],
            [
              10.49456,
              4.555
            ],
            [
              10.69917,
              4.555
            ],
            [
              10.90777,
              4.712
            ],
            [
              11.12043,
              4.712
            ],
            [
              11.33724,
              4.8691
            ],
            [
              11.55828,
              4.8691
            ],
            [
              11.78362,
              4.8691
            ],
            [
              12.01336,
              5.0262
            ],
            [
              12.24758,
              4.8691
            ],
            [
              12.48637,
              5.1832
            ],
            [
              12.72981,
              5.3403
            ],
            [
              12.97799,
              5.3403
            ],
            [
              13.23102,
              5.4974
            ],
            [
              13.48898,
              5.4974
            ],
            [
              13.75197,
              5.8115
            ],
            [
              14.02008,
              5.9686
            ],
            [
              14.29342,
              6.1257
            ],
            [
              14.5721,
              6.1257
            ],
            [
              14.8562,
              6.5969
            ],
            [
              15.14584,
              6.911
            ],
            [
              15.44114,
              6.911
            ],
            [
              15.74218,
              7.3822
            ],
            [
              16.0491,
              7.8534
            ],
            [
              16.362,
              8.3246
            ],
            [
              16.68101,
              8.6387
            ],
            [
              17.00623,
              9.7382
            ],
            [
              17.33779,
              10.3665
            ],
            [
              17.67582,
              10.6806
            ],
            [
              18.02043,
              12.4084
            ],
            [
              18.37177,
              13.5079
            ],
            [
              18.72995,
              15.3927
            ],
            [
              19.09512,
              20.5759
            ],
            [
              19.46741,
              19.4764
            ],
            [
              19.84696,
              23.7173
            ],
            [
              20.2339,
              27.0157
            ],
            [
              20.62839,
              29.8429
            ],
            [
              21.03058,
              28.9005
            ],
            [
              21.4406,
              25.7592
            ],
            [
              21.85862,
              21.6754
            ],
            [
              22.28478,
              17.2775
            ],
            [
              22.71926,
              13.822
            ],
            [
              23.1622,
              11.7801
            ],
            [
              23.61379,
              10.2094
            ],
            [
              24.07417,
              8.4817
            ],
            [
              24.54353,
              7.8534
            ],
            [
              25.02205,
              7.2251
            ],
            [
              25.50989,
              6.2827
            ],
            [
              26.00724,
              5.9686
            ],
            [
              26.51429,
              5.3403
            ],
            [
              27.03123,
              4.8691
            ],
            [
              27.55825,
              4.712
            ],
            [
              28.09554,
              4.555
            ],
            [
              28.6433,
              4.2408
            ],
            [
              29.20175,
              4.0838
            ],
            [
              29.77108,
              3.9267
            ],
            [
              30.35151,
              3.9267
            ],
            [
              30.94326,
              3.9267
            ],
            [
              31.54654,
              3.7696
            ],
            [
              32.16159,
              3.9267
            ],
            [
              32.78863,
              3.9267
            ],
            [
              33.42789,
              3.9267
            ],
            [
              34.07962,
              3.9267
            ],
            [
              34.74405,
              4.2408
            ],
            [
              35.42144,
              4.2408
            ],
            [
              36.11204,
              4.3979
            ],
            [
              36.8161,
              4.555
            ],
            [
              37.53388,
              5.1832
            ],
            [
              38.26566,
              5.6545
            ],
            [
              39.01171,
              6.1257
            ],
            [
              39.7723,
              6.2827
            ],
            [
              40.54772,
              7.5393
            ],
            [
              41.33826,
              8.4817
            ],
            [
              42.14421,
              9.8953
            ],
            [
              42.96588,
              11.466
            ],
            [
              43.80356,
              14.1361
            ],
            [
              44.65758,
              17.7487
            ],
            [
              45.52825,
              22.3037
            ],
            [
              46.41589,
              29.6859
            ],
            [
              47.32084,
              38.3246
            ],
            [
              48.24343,
              40.9948
            ],
            [
              49.18401,
              32.8272
            ],
            [
              50.14292,
              27.3298
            ],
            [
              51.12053,
              21.3613
            ],
            [
              52.11721,
              17.4346
            ],
            [
              53.13331,
              14.9215
            ],
            [
              54.16922,
              13.0366
            ],
            [
              55.22534,
              11.466
            ],
            [
              56.30204,
              10.5236
            ],
            [
              57.39973,
              9.5812
            ],
            [
              58.51883,
              8.7958
            ],
            [
              59.65974,
              8.7958
            ],
            [
              60.82289,
              7.8534
            ],
            [
              62.00873,
              7.5393
            ],
            [
              63.21768,
              7.2251
            ],
            [
              64.45021,
              6.5969
            ],
            [
              65.70676,
              6.5969
            ],
            [
              66.98781,
              6.1257
            ],
            [
              68.29384,
              5.9686
            ],
            [
              69.62533,
              5.9686
            ],
            [
              70.98279,
              5.4974
            ],
            [
              72.3667,
              5.4974
            ],
            [
              73.7776,
              5.3403
            ],
            [
              75.21601,
              5.1832
            ],
            [
              76.68246,
              5.0262
            ],
            [
              78.1775,
              4.8691
            ],
            [
              79.70169,
              5.0262
            ],
            [
              81.25559,
              4.8691
            ],
            [
              82.83979,
              4.712
            ],
            [
              84.45488,
              4.712
            ],
            [
              86.10145,
              4.555
            ],
            [
              87.78013,
              4.555
            ],
            [
              89.49154,
              4.555
            ],
            [
              91.23631,
              4.3979
            ],
            [
              93.0151,
              4.2408
            ],
            [
              94.82857,
              4.2408
            ],
            [
              96.6774,
              4.2408
            ],
            [
              98.56227,
              4.2408
            ],
            [
              100.48389,
              4.2408
            ],
            [
              102.44297,
              4.2408
            ],
            [
              104.44026,
              4.2408
            ],
            [
              106.47648,
              4.2408
            ],
            [
              108.5524,
              4.2408
            ],
            [
              110.66879,
              4.0838
            ],
            [
              112.82644,
              4.0838
            ],
            [
              115.02617,
              3.9267
            ],
            [
              117.26878,
              3.9267
            ],
            [
              119.55511,
              3.9267
            ],
            [
              121.88602,
              3.9267
            ],
            [
              124.26237,
              3.9267
            ],
            [
              126.68505,
              3.9267
            ],
            [
              129.15497,
              3.9267
            ],
            [
              131.67304,
              3.9267
            ],
            [
              134.2402,
              3.9267
            ],
            [
              136.85742,
              3.9267
            ],
            [
              139.52566,
              3.9267
            ],
            [
              142.24592,
              3.9267
            ],
            [
              145.01922,
              3.9267
            ],
            [
              147.84659,
              3.9267
            ],
            [
              150.72909,
              3.9267
            ],
            [
              153.66778,
              3.9267
            ],
            [
              156.66376,
              3.9267
            ],
            [
              159.71816,
              3.9267
            ],
            [
              162.83211,
              3.9267
            ],
            [
              166.00676,
              3.9267
            ],
            [
              169.24332,
              3.9267
            ],
            [
              172.54297,
              3.9267
            ],
            [
              175.90696,
              3.9267
            ],
            [
              179.33653,
              3.9267
            ],
            [
              182.83297,
              3.9267
            ],
            [
              186.39757,
              3.9267
            ],
            [
              190.03167,
              3.9267
            ],
            [
              193.73663,
              3.9267
            ],
            [
              197.51382,
              3.9267
            ],
            [
              201.36465,
              3.9267
            ],
            [
              205.29056,
              3.9267
            ],
            [
              209.29301,
              3.9267
            ],
            [
              213.37349,
              3.9267
            ],
            [
              217.53353,
              3.9267
            ],
            [
              221.77467,
              4.3979
            ],
            [
              226.09851,
              4.0838
            ],
            [
              230.50664,
              3.9267
            ],
            [
              235.00071,
              3.9267
            ],
            [
              239.58241,
              3.9267
            ],
            [
              244.25343,
              3.9267
            ],
            [
              249.01552,
              3.9267
            ],
            [
              253.87045,
              3.9267
            ],
            [
              258.82004,
              3.9267
            ],
            [
              263.86613,
              3.9267
            ],
            [
              269.0106,
              3.9267
            ],
            [
              274.25537,
              3.9267
            ],
            [
              279.60239,
              4.2408
            ],
            [
              285.05366,
              4.2408
            ],
            [
              290.61121,
              4.0838
            ],
            [
              296.27712,
              4.0838
            ],
            [
              302.05349,
              4.2408
            ],
            [
              307.94248,
              4.2408
            ],
            [
              313.94628,
              4.2408
            ],
            [
              320.06714,
              4.2408
            ],
            [
              326.30733,
              4.2408
            ],
            [
              332.66919,
              4.0838
            ],
            [
              339.15508,
              4.2408
            ],
            [
              345.76742,
              4.2408
            ],
            [
              352.50868,
              4.2408
            ],
            [
              359.38137,
              4.2408
            ],
            [
              366.38805,
              4.2408
            ],
            [
              373.53134,
              4.2408
            ],
            [
              380.8139,
              4.2408
            ],
            [
              388.23844,
              4.2408
            ],
            [
              395.80773,
              4.2408
            ],
            [
              403.5246,
              4.2408
            ],
            [
              411.39193,
              4.2408
            ],
            [
              419.41263,
              4.2408
            ],
            [
              427.58972,
              4.2408
            ],
            [
              435.92623,
              4.2408
            ],
            [
              444.42527,
              4.2408
            ],
            [
              453.09001,
              4.2408
            ],
            [
              461.92368,
              4.2408
            ],
            [
              470.92959,
              4.2408
            ],
            [
              480.11107,
              4.2408
            ],
            [
              489.47156,
              4.2408
            ],
            [
              499.01455,
              4.2408
            ],
            [
              508.74359,
              4.2408
            ],
            [
              518.66232,
              4.2408
            ],
            [
              528.77442,
              4.2408
            ],
            [
              539.08368,
              4.2408
            ],
            [
              549.59393,
              4.555
            ],
            [
              560.3091,
              4.555
            ],
            [
              571.23317,
              4.3979
            ],
            [
              582.37022,
              4.3979
            ],
            [
              593.72441,
              4.555
            ],
            [
              605.29997,
              4.555
            ],
            [
              617.1012,
              4.3979
            ],
            [
              629.13253,
              4.3979
            ],
            [
              641.39842,
              4.555
            ],
            [
              653.90345,
              4.555
            ],
            [
              666.65228,
              4.555
            ],
            [
              679.64968,
              4.555
            ],
            [
              692.90048,
              4.555
            ],
            [
              706.40962,
              4.555
            ],
            [
              720.18214,
              4.555
            ],
            [
              734.22318,
              4.555
            ],
            [
              748.53797,
              4.555
            ],
            [
              763.13185,
              4.555
            ],
            [
              778.01026,
              4.555
            ],
            [
              793.17875,
              4.555
            ],
            [
              808.64297,
              4.555
            ],
            [
              824.40868,
              4.555
            ],
            [
              840.48178,
              4.555
            ],
            [
              856.86824,
              4.555
            ],
            [
              873.57418,
              4.712
            ],
            [
              890.60583,
              4.712
            ],
            [
              907.96954,
              4.8691
            ],
            [
              925.67178,
              4.8691
            ],
            [
              943.71915,
              4.712
            ],
            [
              962.11838,
              4.8691
            ],
            [
              980.87633,
              4.712
            ]
          ]
        },
        {
          "id": "fig16-solid-z",
          "title": "Figure16 stuffed TL calculated solid impedance (approximate embedded-raster extraction)",
          "source": "Martin J. King, 2023-09-23 Satori TL report, Figure16; original embedded586x293 JPEG; scripts/extract-satori-impedance.py",
          "evidence": "published-simulation",
          "trace": "calculated-solid",
          "frequencyUncertaintyPercent": 2,
          "metric": "impedance",
          "conditions": {
            "voltage": null,
            "distanceM": null,
            "radiation": "near-field",
            "stuffing": "stuffed",
            "crossover": "bypass",
            "notes": "Approximate solid-curve extraction using contiguous red strokes. Dashed measured curve is separate and is not used as a calculated target. Inspect extraction overlay; dense raster samples are correlated."
          },
          "tolerance": 2,
          "uncertainty": 1,
          "samples": [
            [
              10.09701,
              4.555
            ],
            [
              10.29387,
              4.555
            ],
            [
              10.49456,
              4.555
            ],
            [
              10.69917,
              4.8691
            ],
            [
              10.90777,
              4.8691
            ],
            [
              11.12043,
              4.8691
            ],
            [
              11.33724,
              4.8691
            ],
            [
              11.55828,
              4.8691
            ],
            [
              11.78362,
              5.1832
            ],
            [
              12.01336,
              5.1832
            ],
            [
              12.24758,
              5.1832
            ],
            [
              12.48637,
              5.4974
            ],
            [
              12.72981,
              5.6545
            ],
            [
              12.97799,
              5.6545
            ],
            [
              13.23102,
              5.4974
            ],
            [
              13.48898,
              5.8115
            ],
            [
              13.75197,
              5.9686
            ],
            [
              14.02008,
              6.2827
            ],
            [
              14.29342,
              6.1257
            ],
            [
              14.5721,
              6.4398
            ],
            [
              14.8562,
              6.7539
            ],
            [
              15.14584,
              6.911
            ],
            [
              15.44114,
              6.7539
            ],
            [
              15.74218,
              7.0681
            ],
            [
              16.0491,
              7.3822
            ],
            [
              16.362,
              7.6963
            ],
            [
              16.68101,
              7.6963
            ],
            [
              17.00623,
              7.6963
            ],
            [
              17.33779,
              8.3246
            ],
            [
              17.67582,
              8.3246
            ],
            [
              18.02043,
              8.3246
            ],
            [
              18.37177,
              8.6387
            ],
            [
              18.72995,
              8.7958
            ],
            [
              19.09512,
              8.7958
            ],
            [
              19.46741,
              8.6387
            ],
            [
              19.84696,
              8.6387
            ],
            [
              20.2339,
              8.4817
            ],
            [
              20.62839,
              8.4817
            ],
            [
              21.03058,
              8.6387
            ],
            [
              21.4406,
              8.3246
            ],
            [
              21.85862,
              8.0105
            ],
            [
              22.28478,
              7.8534
            ],
            [
              22.71926,
              8.0105
            ],
            [
              23.1622,
              7.8534
            ],
            [
              23.61379,
              7.6963
            ],
            [
              24.07417,
              7.2251
            ],
            [
              24.54353,
              7.3822
            ],
            [
              25.02205,
              7.3822
            ],
            [
              25.50989,
              6.7539
            ],
            [
              26.00724,
              7.0681
            ],
            [
              26.51429,
              7.0681
            ],
            [
              27.03123,
              7.0681
            ],
            [
              27.55825,
              7.0681
            ],
            [
              28.09554,
              6.5969
            ],
            [
              28.6433,
              6.7539
            ],
            [
              29.20175,
              6.7539
            ],
            [
              29.77108,
              6.5969
            ],
            [
              30.35151,
              7.0681
            ],
            [
              30.94326,
              7.0681
            ],
            [
              31.54654,
              7.0681
            ],
            [
              32.16159,
              7.3822
            ],
            [
              32.78863,
              7.3822
            ],
            [
              33.42789,
              7.6963
            ],
            [
              34.07962,
              7.6963
            ],
            [
              34.74405,
              8.0105
            ],
            [
              35.42144,
              8.3246
            ],
            [
              36.11204,
              8.7958
            ],
            [
              36.8161,
              9.4241
            ],
            [
              37.53388,
              10.0524
            ],
            [
              38.26566,
              10.6806
            ],
            [
              39.01171,
              11.3089
            ],
            [
              39.7723,
              12.2513
            ],
            [
              40.54772,
              13.3508
            ],
            [
              41.33826,
              14.6073
            ],
            [
              42.14421,
              16.0209
            ],
            [
              42.96588,
              17.2775
            ],
            [
              43.80356,
              18.534
            ],
            [
              44.65758,
              15.8639
            ],
            [
              45.52825,
              19.9476
            ],
            [
              46.41589,
              19.1623
            ],
            [
              47.32084,
              18.534
            ],
            [
              48.24343,
              17.2775
            ],
            [
              49.18401,
              15.8639
            ],
            [
              50.14292,
              14.4503
            ],
            [
              51.12053,
              13.1937
            ],
            [
              52.11721,
              12.2513
            ],
            [
              53.13331,
              13.9791
            ],
            [
              54.16922,
              10.5236
            ],
            [
              55.22534,
              9.8953
            ],
            [
              56.30204,
              9.1099
            ],
            [
              57.39973,
              9.267
            ],
            [
              58.51883,
              8.1675
            ],
            [
              59.65974,
              8.1675
            ],
            [
              60.82289,
              8.3246
            ],
            [
              62.00873,
              7.0681
            ],
            [
              63.21768,
              6.911
            ],
            [
              64.45021,
              6.7539
            ],
            [
              65.70676,
              6.2827
            ],
            [
              66.98781,
              6.2827
            ],
            [
              68.29384,
              6.1257
            ],
            [
              69.62533,
              5.8115
            ],
            [
              70.98279,
              5.6545
            ],
            [
              72.3667,
              5.6545
            ],
            [
              73.7776,
              5.3403
            ],
            [
              75.21601,
              5.1832
            ],
            [
              76.68246,
              5.1832
            ],
            [
              78.1775,
              5.0262
            ],
            [
              79.70169,
              4.8691
            ],
            [
              81.25559,
              4.8691
            ],
            [
              82.83979,
              4.8691
            ],
            [
              84.45488,
              4.712
            ],
            [
              86.10145,
              4.555
            ],
            [
              87.78013,
              4.555
            ],
            [
              89.49154,
              4.555
            ],
            [
              91.23631,
              4.555
            ],
            [
              93.0151,
              4.555
            ],
            [
              94.82857,
              4.3979
            ],
            [
              96.6774,
              4.2408
            ],
            [
              98.56227,
              4.2408
            ],
            [
              100.48389,
              4.2408
            ],
            [
              102.44297,
              4.2408
            ],
            [
              104.44026,
              4.2408
            ],
            [
              106.47648,
              4.2408
            ],
            [
              108.5524,
              4.2408
            ],
            [
              110.66879,
              4.2408
            ],
            [
              112.82644,
              4.2408
            ],
            [
              115.02617,
              4.2408
            ],
            [
              117.26878,
              4.0838
            ],
            [
              119.55511,
              4.0838
            ],
            [
              121.88602,
              3.9267
            ],
            [
              124.26237,
              3.9267
            ],
            [
              126.68505,
              3.9267
            ],
            [
              129.15497,
              3.9267
            ],
            [
              131.67304,
              3.9267
            ],
            [
              134.2402,
              3.9267
            ],
            [
              136.85742,
              3.9267
            ],
            [
              139.52566,
              3.9267
            ],
            [
              142.24592,
              3.9267
            ],
            [
              145.01922,
              3.9267
            ],
            [
              147.84659,
              3.9267
            ],
            [
              150.72909,
              3.9267
            ],
            [
              153.66778,
              3.9267
            ],
            [
              156.66376,
              3.9267
            ],
            [
              159.71816,
              3.9267
            ],
            [
              162.83211,
              3.9267
            ],
            [
              166.00676,
              3.9267
            ],
            [
              169.24332,
              3.9267
            ],
            [
              172.54297,
              3.9267
            ],
            [
              175.90696,
              3.9267
            ],
            [
              179.33653,
              3.9267
            ],
            [
              182.83297,
              3.9267
            ],
            [
              186.39757,
              3.9267
            ],
            [
              190.03167,
              3.9267
            ],
            [
              193.73663,
              3.9267
            ],
            [
              197.51382,
              3.9267
            ],
            [
              201.36465,
              3.9267
            ],
            [
              205.29056,
              3.9267
            ],
            [
              209.29301,
              3.9267
            ],
            [
              213.37349,
              3.9267
            ],
            [
              217.53353,
              3.9267
            ],
            [
              221.77467,
              3.9267
            ],
            [
              226.09851,
              3.9267
            ],
            [
              230.50664,
              3.9267
            ],
            [
              235.00071,
              3.9267
            ],
            [
              239.58241,
              3.9267
            ],
            [
              244.25343,
              3.9267
            ],
            [
              249.01552,
              3.9267
            ],
            [
              253.87045,
              3.9267
            ],
            [
              258.82004,
              4.0838
            ],
            [
              263.86613,
              4.2408
            ],
            [
              269.0106,
              4.2408
            ],
            [
              274.25537,
              4.0838
            ],
            [
              279.60239,
              4.0838
            ],
            [
              285.05366,
              4.2408
            ],
            [
              290.61121,
              4.2408
            ],
            [
              296.27712,
              4.0838
            ],
            [
              302.05349,
              4.2408
            ],
            [
              307.94248,
              4.2408
            ],
            [
              313.94628,
              4.2408
            ],
            [
              320.06714,
              4.2408
            ],
            [
              326.30733,
              4.2408
            ],
            [
              332.66919,
              4.2408
            ],
            [
              339.15508,
              4.2408
            ],
            [
              345.76742,
              4.2408
            ],
            [
              352.50868,
              4.2408
            ],
            [
              359.38137,
              4.2408
            ],
            [
              366.38805,
              4.2408
            ],
            [
              373.53134,
              4.2408
            ],
            [
              380.8139,
              4.2408
            ],
            [
              388.23844,
              4.2408
            ],
            [
              395.80773,
              4.2408
            ],
            [
              403.5246,
              4.2408
            ],
            [
              411.39193,
              4.2408
            ],
            [
              419.41263,
              4.2408
            ],
            [
              427.58972,
              4.2408
            ],
            [
              435.92623,
              4.2408
            ],
            [
              444.42527,
              4.2408
            ],
            [
              453.09001,
              4.2408
            ],
            [
              461.92368,
              4.2408
            ],
            [
              470.92959,
              4.2408
            ],
            [
              480.11107,
              4.2408
            ],
            [
              489.47156,
              4.2408
            ],
            [
              499.01455,
              4.2408
            ],
            [
              508.74359,
              4.2408
            ],
            [
              518.66232,
              4.2408
            ],
            [
              528.77442,
              4.2408
            ],
            [
              539.08368,
              4.2408
            ],
            [
              549.59393,
              4.3979
            ],
            [
              560.3091,
              4.3979
            ],
            [
              571.23317,
              4.555
            ],
            [
              582.37022,
              4.555
            ],
            [
              593.72441,
              4.3979
            ],
            [
              605.29997,
              4.3979
            ],
            [
              617.1012,
              4.555
            ],
            [
              629.13253,
              4.3979
            ],
            [
              641.39842,
              4.555
            ],
            [
              653.90345,
              4.555
            ],
            [
              666.65228,
              4.555
            ],
            [
              679.64968,
              4.555
            ],
            [
              692.90048,
              4.555
            ],
            [
              706.40962,
              4.555
            ],
            [
              720.18214,
              4.555
            ],
            [
              734.22318,
              4.555
            ],
            [
              748.53797,
              4.555
            ],
            [
              763.13185,
              4.555
            ],
            [
              778.01026,
              4.555
            ],
            [
              793.17875,
              4.555
            ],
            [
              808.64297,
              4.555
            ],
            [
              824.40868,
              4.555
            ],
            [
              840.48178,
              4.555
            ],
            [
              856.86824,
              4.555
            ],
            [
              873.57418,
              4.712
            ],
            [
              890.60583,
              4.8691
            ],
            [
              907.96954,
              4.8691
            ],
            [
              925.67178,
              4.712
            ],
            [
              943.71915,
              4.8691
            ],
            [
              962.11838,
              4.8691
            ],
            [
              980.87633,
              4.8691
            ]
          ]
        }
      ],
      "modalReference": {
        "source": "Martin J. King, The Two-Year Transmission Line Speaker Design, 2023-09-23; http://quarter-wave.com/Project13/Satori_TL_Design_Documentation.pdf; Fig 11 traditional centerline method (rounded table values). Compare ANSYS separately; its boundary is also p=0 but geometry is three-dimensional.",
        "frequencies": [
          33,
          134,
          228,
          321,
          415,
          506,
          597,
          691
        ],
        "tolerancePercent": 2
      }
    }
  },
  "drivers": [
    {
      "id": "primary",
      "name": "Satori WO24P-4 · King's measured set",
      "rearLoading": "cabinet",
      "crossover": {
        "passive": [
          {
            "connection": "series",
            "kind": "L",
            "value": 0.0035,
            "resistance": 0.81
          },
          {
            "connection": "shunt",
            "kind": "C",
            "value": 0.000036
          }
        ]
      }
    },
    {
      "id": "tweeter",
      "name": "Satori TW29R · Fig 6 consistent",
      "rearLoading": "sealed-back",
      "crossover": {
        "passive": [
          {
            "connection": "series",
            "kind": "C",
            "value": 0.000018
          },
          {
            "connection": "shunt",
            "kind": "L",
            "value": 0.00033,
            "resistance": 0.1
          },
          {
            "connection": "series",
            "kind": "R",
            "value": 2.5
          },
          {
            "connection": "shunt",
            "kind": "R",
            "value": 1.5
          }
        ]
      }
    }
  ],
  "profileVolumeLitres": 75.44675584990006,
  "cadVolumeLitres": 72.76926587168758,
  "curves": [
    {
      "id": "fig18-total",
      "title": "Fig 18 passive anechoic sum at 3 m (approximate raster)",
      "source": "Martin J. King, The Two-Year Transmission Line Speaker Design, 2023-09-23; http://quarter-wave.com/Project13/Satori_TL_Design_Documentation.pdf; Fig 18 passive anechoic sum at 3 m (approximate raster)",
      "evidence": "published-simulation",
      "trace": "unspecified",
      "frequencyUncertaintyPercent": null,
      "metric": "spl",
      "conditions": {
        "voltage": null,
        "distanceM": 3,
        "radiation": "anechoic",
        "stuffing": "stuffed",
        "crossover": "passive",
        "notes": "The paper text does not explicitly identify input voltage for this graph. Local drive2.83Vrms is ASSUMED, not a verified published test condition.",
        "microphoneMm": [
          114.3,
          850.9,
          -3000
        ]
      },
      "tolerance": 2,
      "uncertainty": 0.6,
      "rows": [
        {
          "frequency": 10,
          "expected": 41.025,
          "actual": 42.12331924048344,
          "error": 1.0983192404834412
        },
        {
          "frequency": 15,
          "expected": 53.525,
          "actual": 52.50874792610192,
          "error": -1.0162520738980803
        },
        {
          "frequency": 20,
          "expected": 61.926,
          "actual": 59.178788693696006,
          "error": -2.7472113063039956
        },
        {
          "frequency": 30,
          "expected": 70.123,
          "actual": 67.42020178979597,
          "error": -2.702798210204037
        },
        {
          "frequency": 40,
          "expected": 74.016,
          "actual": 72.31131150034436,
          "error": -1.7046884996556457
        },
        {
          "frequency": 50,
          "expected": 76.27,
          "actual": 75.19786011616377,
          "error": -1.072139883836229
        },
        {
          "frequency": 70,
          "expected": 77.09,
          "actual": 77.22366553352524,
          "error": 0.1336655335252317
        },
        {
          "frequency": 100,
          "expected": 76.27,
          "actual": 76.65135281352894,
          "error": 0.3813528135289488
        },
        {
          "frequency": 150,
          "expected": 74.426,
          "actual": 73.68471334590218,
          "error": -0.74128665409782
        },
        {
          "frequency": 200,
          "expected": 75.246,
          "actual": 70.77478532130985,
          "error": -4.471214678690146
        },
        {
          "frequency": 300,
          "expected": 75.451,
          "actual": 73.49345898142475,
          "error": -1.9575410185752418
        },
        {
          "frequency": 500,
          "expected": 74.016,
          "actual": 71.7564069201646,
          "error": -2.259593079835412
        },
        {
          "frequency": 700,
          "expected": 73.811,
          "actual": 70.56424035929139,
          "error": -3.2467596407086177
        },
        {
          "frequency": 1000,
          "expected": 73.197,
          "actual": 68.63775626052106,
          "error": -4.559243739478944
        },
        {
          "frequency": 1500,
          "expected": 72.787,
          "actual": 70.67620002546153,
          "error": -2.1107999745384802
        },
        {
          "frequency": 2000,
          "expected": 72.172,
          "actual": 71.92774074431554,
          "error": -0.2442592556844545
        },
        {
          "frequency": 3000,
          "expected": 72.582,
          "actual": 73.20408896401567,
          "error": 0.6220889640156742
        },
        {
          "frequency": 7000,
          "expected": 72.582,
          "actual": 73.2202888788621,
          "error": 0.638288878862113
        }
      ],
      "peaks": [],
      "rmse": 2.2038702985916183,
      "maxError": 4.559243739478944,
      "issues": [
        "Reference drive voltage is unknown; absolute SPL cannot be verified.",
        "anechoic measurement is not validated by the current radiation approximation.",
        "Stuffing parameters are assumed or fitted; independent material validation is pending.",
        "Reference extends above the radiation/plane-wave model limits."
      ],
      "status": "incompatible"
    },
    {
      "id": "fig15-solid-z",
      "title": "Figure15 empty TL calculated solid impedance (approximate embedded-raster extraction)",
      "source": "Martin J. King, 2023-09-23 Satori TL report, Figure15; original embedded586x293 JPEG; scripts/extract-satori-impedance.py",
      "evidence": "published-simulation",
      "trace": "calculated-solid",
      "frequencyUncertaintyPercent": 2,
      "metric": "impedance",
      "conditions": {
        "voltage": null,
        "distanceM": null,
        "radiation": "near-field",
        "stuffing": "empty",
        "crossover": "bypass",
        "notes": "Approximate solid-curve extraction using contiguous red strokes. Dashed measured curve is separate and is not used as a calculated target. Inspect extraction overlay; dense raster samples are correlated."
      },
      "tolerance": 2,
      "uncertainty": 1,
      "rows": [
        {
          "frequency": 10.09701,
          "expected": 4.555,
          "actual": 5.2284904992221914,
          "error": 0.6734904992221917
        },
        {
          "frequency": 10.29387,
          "expected": 4.555,
          "actual": 5.275075770286237,
          "error": 0.720075770286237
        },
        {
          "frequency": 10.49456,
          "expected": 4.555,
          "actual": 5.323245093054173,
          "error": 0.7682450930541735
        },
        {
          "frequency": 10.69917,
          "expected": 4.555,
          "actual": 5.3730063829446735,
          "error": 0.8180063829446738
        },
        {
          "frequency": 10.90777,
          "expected": 4.712,
          "actual": 5.424355094764138,
          "error": 0.7123550947641384
        },
        {
          "frequency": 11.12043,
          "expected": 4.712,
          "actual": 5.477277975330911,
          "error": 0.7652779753309114
        },
        {
          "frequency": 11.33724,
          "expected": 4.8691,
          "actual": 5.531757138844067,
          "error": 0.6626571388440663
        },
        {
          "frequency": 11.55828,
          "expected": 4.8691,
          "actual": 5.587761646818845,
          "error": 0.7186616468188447
        },
        {
          "frequency": 11.78362,
          "expected": 4.8691,
          "actual": 5.645246381724055,
          "error": 0.7761463817240548
        },
        {
          "frequency": 12.01336,
          "expected": 5.0262,
          "actual": 5.704161280840779,
          "error": 0.6779612808407789
        },
        {
          "frequency": 12.24758,
          "expected": 4.8691,
          "actual": 5.764437669313851,
          "error": 0.8953376693138502
        },
        {
          "frequency": 12.48637,
          "expected": 5.1832,
          "actual": 5.825995043361818,
          "error": 0.6427950433618177
        },
        {
          "frequency": 12.72981,
          "expected": 5.3403,
          "actual": 5.888735194643689,
          "error": 0.5484351946436892
        },
        {
          "frequency": 12.97799,
          "expected": 5.3403,
          "actual": 5.95254680305306,
          "error": 0.6122468030530603
        },
        {
          "frequency": 13.23102,
          "expected": 5.4974,
          "actual": 6.017307614885087,
          "error": 0.5199076148850867
        },
        {
          "frequency": 13.48898,
          "expected": 5.4974,
          "actual": 6.082871506311857,
          "error": 0.5854715063118574
        },
        {
          "frequency": 13.75197,
          "expected": 5.8115,
          "actual": 6.149081546496968,
          "error": 0.3375815464969687
        },
        {
          "frequency": 14.02008,
          "expected": 5.9686,
          "actual": 6.215762974234455,
          "error": 0.24716297423445432
        },
        {
          "frequency": 14.29342,
          "expected": 6.1257,
          "actual": 6.2827317344025335,
          "error": 0.15703173440253337
        },
        {
          "frequency": 14.5721,
          "expected": 6.1257,
          "actual": 6.349790857061801,
          "error": 0.22409085706180054
        },
        {
          "frequency": 14.8562,
          "expected": 6.5969,
          "actual": 6.4167254944271495,
          "error": -0.1801745055728503
        },
        {
          "frequency": 15.14584,
          "expected": 6.911,
          "actual": 6.483322295797795,
          "error": -0.4276777042022042
        },
        {
          "frequency": 15.44114,
          "expected": 6.911,
          "actual": 6.549362634983054,
          "error": -0.36163736501694554
        },
        {
          "frequency": 15.74218,
          "expected": 7.3822,
          "actual": 6.614617762828993,
          "error": -0.7675822371710073
        },
        {
          "frequency": 16.0491,
          "expected": 7.8534,
          "actual": 6.678875105911095,
          "error": -1.174524894088905
        },
        {
          "frequency": 16.362,
          "expected": 8.3246,
          "actual": 6.741920967245417,
          "error": -1.5826790327545837
        },
        {
          "frequency": 16.68101,
          "expected": 8.6387,
          "actual": 6.803560420490724,
          "error": -1.835139579509276
        },
        {
          "frequency": 17.00623,
          "expected": 9.7382,
          "actual": 6.863610566264032,
          "error": -2.874589433735969
        },
        {
          "frequency": 17.33779,
          "expected": 10.3665,
          "actual": 6.921917556882996,
          "error": -3.444582443117004
        },
        {
          "frequency": 17.67582,
          "expected": 10.6806,
          "actual": 6.97835578770512,
          "error": -3.7022442122948798
        },
        {
          "frequency": 18.02043,
          "expected": 12.4084,
          "actual": 7.032829987750866,
          "error": -5.375570012249134
        },
        {
          "frequency": 18.37177,
          "expected": 13.5079,
          "actual": 7.085289591539227,
          "error": -6.4226104084607725
        },
        {
          "frequency": 18.72995,
          "expected": 15.3927,
          "actual": 7.135720363309468,
          "error": -8.25697963669053
        },
        {
          "frequency": 19.09512,
          "expected": 20.5759,
          "actual": 7.184159982118356,
          "error": -13.391740017881645
        },
        {
          "frequency": 19.46741,
          "expected": 19.4764,
          "actual": 7.230692063055612,
          "error": -12.24570793694439
        },
        {
          "frequency": 19.84696,
          "expected": 23.7173,
          "actual": 7.275452451999103,
          "error": -16.4418475480009
        },
        {
          "frequency": 20.2339,
          "expected": 27.0157,
          "actual": 7.318627999971722,
          "error": -19.697072000028278
        },
        {
          "frequency": 20.62839,
          "expected": 29.8429,
          "actual": 7.360461497035561,
          "error": -22.48243850296444
        },
        {
          "frequency": 21.03058,
          "expected": 28.9005,
          "actual": 7.40124681457432,
          "error": -21.49925318542568
        },
        {
          "frequency": 21.4406,
          "expected": 25.7592,
          "actual": 7.441327554359749,
          "error": -18.31787244564025
        },
        {
          "frequency": 21.85862,
          "expected": 21.6754,
          "actual": 7.481101858946239,
          "error": -14.19429814105376
        },
        {
          "frequency": 22.28478,
          "expected": 17.2775,
          "actual": 7.5210141921291225,
          "error": -9.756485807870877
        },
        {
          "frequency": 22.71926,
          "expected": 13.822,
          "actual": 7.561560770515034,
          "error": -6.260439229484965
        },
        {
          "frequency": 23.1622,
          "expected": 11.7801,
          "actual": 7.603281013116861,
          "error": -4.176818986883138
        },
        {
          "frequency": 23.61379,
          "expected": 10.2094,
          "actual": 7.646765441751826,
          "error": -2.562634558248175
        },
        {
          "frequency": 24.07417,
          "expected": 8.4817,
          "actual": 7.692646270114543,
          "error": -0.789053729885457
        },
        {
          "frequency": 24.54353,
          "expected": 7.8534,
          "actual": 7.741608009839894,
          "error": -0.1117919901601061
        },
        {
          "frequency": 25.02205,
          "expected": 7.2251,
          "actual": 7.79438390532337,
          "error": 0.5692839053233696
        },
        {
          "frequency": 25.50989,
          "expected": 6.2827,
          "actual": 7.851757798024846,
          "error": 1.5690577980248461
        },
        {
          "frequency": 26.00724,
          "expected": 5.9686,
          "actual": 7.914574512174374,
          "error": 1.9459745121743737
        },
        {
          "frequency": 26.51429,
          "expected": 5.3403,
          "actual": 7.983743325653278,
          "error": 2.643443325653278
        },
        {
          "frequency": 27.03123,
          "expected": 4.8691,
          "actual": 8.060246332622858,
          "error": 3.191146332622858
        },
        {
          "frequency": 27.55825,
          "expected": 4.712,
          "actual": 8.14514887408298,
          "error": 3.4331488740829794
        },
        {
          "frequency": 28.09554,
          "expected": 4.555,
          "actual": 8.239612286332054,
          "error": 3.6846122863320545
        },
        {
          "frequency": 28.6433,
          "expected": 4.2408,
          "actual": 8.344911249131574,
          "error": 4.104111249131574
        },
        {
          "frequency": 29.20175,
          "expected": 4.0838,
          "actual": 8.462455163442531,
          "error": 4.378655163442531
        },
        {
          "frequency": 29.77108,
          "expected": 3.9267,
          "actual": 8.593799788836945,
          "error": 4.6670997888369445
        },
        {
          "frequency": 30.35151,
          "expected": 3.9267,
          "actual": 8.740685104401043,
          "error": 4.813985104401043
        },
        {
          "frequency": 30.94326,
          "expected": 3.9267,
          "actual": 8.905058922138293,
          "error": 4.978358922138293
        },
        {
          "frequency": 31.54654,
          "expected": 3.7696,
          "actual": 9.089106450700427,
          "error": 5.319506450700427
        },
        {
          "frequency": 32.16159,
          "expected": 3.9267,
          "actual": 9.295298659489477,
          "error": 5.368598659489477
        },
        {
          "frequency": 32.78863,
          "expected": 3.9267,
          "actual": 9.526415585750323,
          "error": 5.599715585750323
        },
        {
          "frequency": 33.42789,
          "expected": 3.9267,
          "actual": 9.7855926104993,
          "error": 5.8588926104993
        },
        {
          "frequency": 34.07962,
          "expected": 3.9267,
          "actual": 10.076357591659741,
          "error": 6.149657591659741
        },
        {
          "frequency": 34.74405,
          "expected": 4.2408,
          "actual": 10.402629491039542,
          "error": 6.161829491039542
        },
        {
          "frequency": 35.42144,
          "expected": 4.2408,
          "actual": 10.768723476900043,
          "error": 6.5279234769000425
        },
        {
          "frequency": 36.11204,
          "expected": 4.3979,
          "actual": 11.179252274136468,
          "error": 6.781352274136468
        },
        {
          "frequency": 36.8161,
          "expected": 4.555,
          "actual": 11.638935900595172,
          "error": 7.083935900595172
        },
        {
          "frequency": 37.53388,
          "expected": 5.1832,
          "actual": 12.15221945100578,
          "error": 6.969019451005781
        },
        {
          "frequency": 38.26566,
          "expected": 5.6545,
          "actual": 12.72257044288167,
          "error": 7.0680704428816705
        },
        {
          "frequency": 39.01171,
          "expected": 6.1257,
          "actual": 13.351228228298258,
          "error": 7.225528228298257
        },
        {
          "frequency": 39.7723,
          "expected": 6.2827,
          "actual": 14.035204317163014,
          "error": 7.752504317163014
        },
        {
          "frequency": 40.54772,
          "expected": 7.5393,
          "actual": 14.764248470980698,
          "error": 7.224948470980698
        },
        {
          "frequency": 41.33826,
          "expected": 8.4817,
          "actual": 15.51663018834496,
          "error": 7.03493018834496
        },
        {
          "frequency": 42.14421,
          "expected": 9.8953,
          "actual": 16.254306737167038,
          "error": 6.359006737167038
        },
        {
          "frequency": 42.96588,
          "expected": 11.466,
          "actual": 16.91938025611882,
          "error": 5.453380256118821
        },
        {
          "frequency": 43.80356,
          "expected": 14.1361,
          "actual": 17.435668225276448,
          "error": 3.299568225276447
        },
        {
          "frequency": 44.65758,
          "expected": 17.7487,
          "actual": 17.720340100366734,
          "error": -0.028359899633265684
        },
        {
          "frequency": 45.52825,
          "expected": 22.3037,
          "actual": 17.70667320723776,
          "error": -4.5970267927622395
        },
        {
          "frequency": 46.41589,
          "expected": 29.6859,
          "actual": 17.36980280296509,
          "error": -12.31609719703491
        },
        {
          "frequency": 47.32084,
          "expected": 38.3246,
          "actual": 16.73933770293421,
          "error": -21.585262297065785
        },
        {
          "frequency": 48.24343,
          "expected": 40.9948,
          "actual": 15.888940044853642,
          "error": -25.105859955146357
        },
        {
          "frequency": 49.18401,
          "expected": 32.8272,
          "actual": 14.909976377600875,
          "error": -17.91722362239912
        },
        {
          "frequency": 50.14292,
          "expected": 27.3298,
          "actual": 13.886131736295097,
          "error": -13.443668263704902
        },
        {
          "frequency": 51.12053,
          "expected": 21.3613,
          "actual": 12.879709995384594,
          "error": -8.481590004615406
        },
        {
          "frequency": 52.11721,
          "expected": 17.4346,
          "actual": 11.929698775288498,
          "error": -5.504901224711501
        },
        {
          "frequency": 53.13331,
          "expected": 14.9215,
          "actual": 11.0561730296593,
          "error": -3.8653269703407
        },
        {
          "frequency": 54.16922,
          "expected": 13.0366,
          "actual": 10.266207497758502,
          "error": -2.7703925022414975
        },
        {
          "frequency": 55.22534,
          "expected": 11.466,
          "actual": 9.559043054203336,
          "error": -1.9069569457966633
        },
        {
          "frequency": 56.30204,
          "expected": 10.5236,
          "actual": 8.929751497862886,
          "error": -1.5938485021371136
        },
        {
          "frequency": 57.39973,
          "expected": 9.5812,
          "actual": 8.37149695589164,
          "error": -1.2097030441083607
        },
        {
          "frequency": 58.51883,
          "expected": 8.7958,
          "actual": 7.8769079159775455,
          "error": -0.9188920840224544
        },
        {
          "frequency": 59.65974,
          "expected": 8.7958,
          "actual": 7.438813836265032,
          "error": -1.3569861637349678
        },
        {
          "frequency": 60.82289,
          "expected": 7.8534,
          "actual": 7.050573879704083,
          "error": -0.8028261202959168
        },
        {
          "frequency": 62.00873,
          "expected": 7.5393,
          "actual": 6.706223052106745,
          "error": -0.8330769478932547
        },
        {
          "frequency": 63.21768,
          "expected": 7.2251,
          "actual": 6.400507937229515,
          "error": -0.8245920627704857
        },
        {
          "frequency": 64.45021,
          "expected": 6.5969,
          "actual": 6.12882769441905,
          "error": -0.46807230558095014
        },
        {
          "frequency": 65.70676,
          "expected": 6.5969,
          "actual": 5.887193135428371,
          "error": -0.7097068645716291
        },
        {
          "frequency": 66.98781,
          "expected": 6.1257,
          "actual": 5.6721408478812005,
          "error": -0.4535591521187996
        },
        {
          "frequency": 68.29384,
          "expected": 5.9686,
          "actual": 5.480673619478856,
          "error": -0.48792638052114423
        },
        {
          "frequency": 69.62533,
          "expected": 5.9686,
          "actual": 5.310195879847245,
          "error": -0.6584041201527553
        },
        {
          "frequency": 70.98279,
          "expected": 5.4974,
          "actual": 5.158453378910607,
          "error": -0.3389466210893932
        },
        {
          "frequency": 72.3667,
          "expected": 5.4974,
          "actual": 5.023491007601677,
          "error": -0.4739089923983224
        },
        {
          "frequency": 73.7776,
          "expected": 5.3403,
          "actual": 4.903600854302927,
          "error": -0.436699145697073
        },
        {
          "frequency": 75.21601,
          "expected": 5.1832,
          "actual": 4.797294656567433,
          "error": -0.385905343432567
        },
        {
          "frequency": 76.68246,
          "expected": 5.0262,
          "actual": 4.703269700619939,
          "error": -0.32293029938006157
        },
        {
          "frequency": 78.1775,
          "expected": 4.8691,
          "actual": 4.620382431068676,
          "error": -0.24871756893132435
        },
        {
          "frequency": 79.70169,
          "expected": 5.0262,
          "actual": 4.547627329177911,
          "error": -0.4785726708220892
        },
        {
          "frequency": 81.25559,
          "expected": 4.8691,
          "actual": 4.484118624643168,
          "error": -0.3849813753568325
        },
        {
          "frequency": 82.83979,
          "expected": 4.712,
          "actual": 4.429073218822376,
          "error": -0.2829267811776237
        },
        {
          "frequency": 84.45488,
          "expected": 4.712,
          "actual": 4.381798619624815,
          "error": -0.33020138037518443
        },
        {
          "frequency": 86.10145,
          "expected": 4.555,
          "actual": 4.3416812062960055,
          "error": -0.2133187937039942
        },
        {
          "frequency": 87.78013,
          "expected": 4.555,
          "actual": 4.308175546529236,
          "error": -0.24682445347076332
        },
        {
          "frequency": 89.49154,
          "expected": 4.555,
          "actual": 4.280797367871294,
          "error": -0.27420263212870566
        },
        {
          "frequency": 91.23631,
          "expected": 4.3979,
          "actual": 4.25911577199795,
          "error": -0.13878422800204948
        },
        {
          "frequency": 93.0151,
          "expected": 4.2408,
          "actual": 4.242746928005483,
          "error": 0.0019469280054824623
        },
        {
          "frequency": 94.82857,
          "expected": 4.2408,
          "actual": 4.231349173007609,
          "error": -0.009450826992391193
        },
        {
          "frequency": 96.6774,
          "expected": 4.2408,
          "actual": 4.224618143654308,
          "error": -0.016181856345691692
        },
        {
          "frequency": 98.56227,
          "expected": 4.2408,
          "actual": 4.222282784392104,
          "error": -0.018517215607896098
        },
        {
          "frequency": 100.48389,
          "expected": 4.2408,
          "actual": 4.224101613227983,
          "error": -0.01669838677201696
        },
        {
          "frequency": 102.44297,
          "expected": 4.2408,
          "actual": 4.229859467775791,
          "error": -0.01094053222420932
        },
        {
          "frequency": 104.44026,
          "expected": 4.2408,
          "actual": 4.239364537587613,
          "error": -0.001435462412387345
        },
        {
          "frequency": 106.47648,
          "expected": 4.2408,
          "actual": 4.252445213722569,
          "error": 0.011645213722569103
        },
        {
          "frequency": 108.5524,
          "expected": 4.2408,
          "actual": 4.268947743260489,
          "error": 0.0281477432604893
        },
        {
          "frequency": 110.66879,
          "expected": 4.0838,
          "actual": 4.288733499043802,
          "error": 0.20493349904380231
        },
        {
          "frequency": 112.82644,
          "expected": 4.0838,
          "actual": 4.311676845077986,
          "error": 0.22787684507798556
        },
        {
          "frequency": 115.02617,
          "expected": 3.9267,
          "actual": 4.337663361527045,
          "error": 0.41096336152704493
        },
        {
          "frequency": 117.26878,
          "expected": 3.9267,
          "actual": 4.366587728384933,
          "error": 0.43988772838493295
        },
        {
          "frequency": 119.55511,
          "expected": 3.9267,
          "actual": 4.398353352117721,
          "error": 0.4716533521177211
        },
        {
          "frequency": 121.88602,
          "expected": 3.9267,
          "actual": 4.432871606554715,
          "error": 0.5061716065547155
        },
        {
          "frequency": 124.26237,
          "expected": 3.9267,
          "actual": 4.470061361583023,
          "error": 0.5433613615830235
        },
        {
          "frequency": 126.68505,
          "expected": 3.9267,
          "actual": 4.509849549760858,
          "error": 0.5831495497608583
        },
        {
          "frequency": 129.15497,
          "expected": 3.9267,
          "actual": 4.552171305954833,
          "error": 0.6254713059548336
        },
        {
          "frequency": 131.67304,
          "expected": 3.9267,
          "actual": 4.596969853645604,
          "error": 0.6702698536456038
        },
        {
          "frequency": 134.2402,
          "expected": 3.9267,
          "actual": 4.6441971070546355,
          "error": 0.7174971070546357
        },
        {
          "frequency": 136.85742,
          "expected": 3.9267,
          "actual": 4.693813585277657,
          "error": 0.7671135852776572
        },
        {
          "frequency": 139.52566,
          "expected": 3.9267,
          "actual": 4.745787286377784,
          "error": 0.8190872863777838
        },
        {
          "frequency": 142.24592,
          "expected": 3.9267,
          "actual": 4.800094032639079,
          "error": 0.8733940326390788
        },
        {
          "frequency": 145.01922,
          "expected": 3.9267,
          "actual": 4.856716322723345,
          "error": 0.9300163227233456
        },
        {
          "frequency": 147.84659,
          "expected": 3.9267,
          "actual": 4.915642175905889,
          "error": 0.9889421759058892
        },
        {
          "frequency": 150.72909,
          "expected": 3.9267,
          "actual": 4.976864460010815,
          "error": 1.0501644600108153
        },
        {
          "frequency": 153.66778,
          "expected": 3.9267,
          "actual": 5.040379047004136,
          "error": 1.1136790470041364
        },
        {
          "frequency": 156.66376,
          "expected": 3.9267,
          "actual": 5.1061843136674065,
          "error": 1.1794843136674067
        },
        {
          "frequency": 159.71816,
          "expected": 3.9267,
          "actual": 5.174279445648901,
          "error": 1.2475794456489013
        },
        {
          "frequency": 162.83211,
          "expected": 3.9267,
          "actual": 5.244662094988837,
          "error": 1.3179620949888373
        },
        {
          "frequency": 166.00676,
          "expected": 3.9267,
          "actual": 5.317326993178219,
          "error": 1.3906269931782194
        },
        {
          "frequency": 169.24332,
          "expected": 3.9267,
          "actual": 5.3922650274131625,
          "error": 1.4655650274131626
        },
        {
          "frequency": 172.54297,
          "expected": 3.9267,
          "actual": 5.469459529851697,
          "error": 1.5427595298516974
        },
        {
          "frequency": 175.90696,
          "expected": 3.9267,
          "actual": 5.548887666647045,
          "error": 1.622187666647045
        },
        {
          "frequency": 179.33653,
          "expected": 3.9267,
          "actual": 5.630519262324761,
          "error": 1.7038192623247608
        },
        {
          "frequency": 182.83297,
          "expected": 3.9267,
          "actual": 5.714321900434421,
          "error": 1.7876219004344214
        },
        {
          "frequency": 186.39757,
          "expected": 3.9267,
          "actual": 5.8002683172834795,
          "error": 1.8735683172834796
        },
        {
          "frequency": 190.03167,
          "expected": 3.9267,
          "actual": 5.8883531074504365,
          "error": 1.9616531074504366
        },
        {
          "frequency": 193.73663,
          "expected": 3.9267,
          "actual": 5.97861558007715,
          "error": 2.0519155800771505
        },
        {
          "frequency": 197.51382,
          "expected": 3.9267,
          "actual": 6.07116950489115,
          "error": 2.1444695048911497
        },
        {
          "frequency": 201.36465,
          "expected": 3.9267,
          "actual": 6.166233603911328,
          "error": 2.2395336039113283
        },
        {
          "frequency": 205.29056,
          "expected": 3.9267,
          "actual": 6.264148511546075,
          "error": 2.3374485115460755
        },
        {
          "frequency": 209.29301,
          "expected": 3.9267,
          "actual": 6.36536688418534,
          "error": 2.43866688418534
        },
        {
          "frequency": 213.37349,
          "expected": 3.9267,
          "actual": 6.470409835394671,
          "error": 2.543709835394671
        },
        {
          "frequency": 217.53353,
          "expected": 3.9267,
          "actual": 6.579797812818286,
          "error": 2.653097812818286
        },
        {
          "frequency": 221.77467,
          "expected": 4.3979,
          "actual": 6.693979041809804,
          "error": 2.2960790418098043
        },
        {
          "frequency": 226.09851,
          "expected": 4.0838,
          "actual": 6.81328546700787,
          "error": 2.72948546700787
        },
        {
          "frequency": 230.50664,
          "expected": 3.9267,
          "actual": 6.937923959603758,
          "error": 3.011223959603758
        },
        {
          "frequency": 235.00071,
          "expected": 3.9267,
          "actual": 7.068003734769965,
          "error": 3.141303734769965
        },
        {
          "frequency": 239.58241,
          "expected": 3.9267,
          "actual": 7.203576255882386,
          "error": 3.2768762558823865
        },
        {
          "frequency": 244.25343,
          "expected": 3.9267,
          "actual": 7.34467244818176,
          "error": 3.4179724481817604
        },
        {
          "frequency": 249.01552,
          "expected": 3.9267,
          "actual": 7.491331440709598,
          "error": 3.5646314407095985
        },
        {
          "frequency": 253.87045,
          "expected": 3.9267,
          "actual": 7.643613119489467,
          "error": 3.7169131194894676
        },
        {
          "frequency": 258.82004,
          "expected": 3.9267,
          "actual": 7.8016024946156195,
          "error": 3.8749024946156196
        },
        {
          "frequency": 263.86613,
          "expected": 3.9267,
          "actual": 7.965407072615497,
          "error": 4.038707072615496
        },
        {
          "frequency": 269.0106,
          "expected": 3.9267,
          "actual": 8.135157317823795,
          "error": 4.208457317823795
        },
        {
          "frequency": 274.25537,
          "expected": 3.9267,
          "actual": 8.311016708371183,
          "error": 4.384316708371182
        },
        {
          "frequency": 279.60239,
          "expected": 4.2408,
          "actual": 8.493212304177794,
          "error": 4.252412304177794
        },
        {
          "frequency": 285.05366,
          "expected": 4.2408,
          "actual": 8.68209544589887,
          "error": 4.44129544589887
        },
        {
          "frequency": 290.61121,
          "expected": 4.0838,
          "actual": 8.878223487717245,
          "error": 4.7944234877172445
        },
        {
          "frequency": 296.27712,
          "expected": 4.0838,
          "actual": 9.08242720719448,
          "error": 4.998627207194479
        },
        {
          "frequency": 302.05349,
          "expected": 4.2408,
          "actual": 9.295796263268148,
          "error": 5.054996263268148
        },
        {
          "frequency": 307.94248,
          "expected": 4.2408,
          "actual": 9.519549883252594,
          "error": 5.278749883252594
        },
        {
          "frequency": 313.94628,
          "expected": 4.2408,
          "actual": 9.7548429190037,
          "error": 5.5140429190037
        },
        {
          "frequency": 320.06714,
          "expected": 4.2408,
          "actual": 10.002634377413347,
          "error": 5.761834377413347
        },
        {
          "frequency": 326.30733,
          "expected": 4.2408,
          "actual": 10.263687146530605,
          "error": 6.022887146530605
        },
        {
          "frequency": 332.66919,
          "expected": 4.0838,
          "actual": 10.538671238521049,
          "error": 6.454871238521049
        },
        {
          "frequency": 339.15508,
          "expected": 4.2408,
          "actual": 10.828281147919594,
          "error": 6.587481147919593
        },
        {
          "frequency": 345.76742,
          "expected": 4.2408,
          "actual": 11.133323123666196,
          "error": 6.892523123666196
        },
        {
          "frequency": 352.50868,
          "expected": 4.2408,
          "actual": 11.454759578521108,
          "error": 7.2139595785211075
        },
        {
          "frequency": 359.38137,
          "expected": 4.2408,
          "actual": 11.79372724810287,
          "error": 7.55292724810287
        },
        {
          "frequency": 366.38805,
          "expected": 4.2408,
          "actual": 12.151543482732258,
          "error": 7.910743482732258
        },
        {
          "frequency": 373.53134,
          "expected": 4.2408,
          "actual": 12.529700694151956,
          "error": 8.288900694151955
        },
        {
          "frequency": 380.8139,
          "expected": 4.2408,
          "actual": 12.92983765017693,
          "error": 8.68903765017693
        },
        {
          "frequency": 388.23844,
          "expected": 4.2408,
          "actual": 13.353697360412207,
          "error": 9.112897360412207
        },
        {
          "frequency": 395.80773,
          "expected": 4.2408,
          "actual": 13.803117190495998,
          "error": 9.562317190495998
        },
        {
          "frequency": 403.5246,
          "expected": 4.2408,
          "actual": 14.280074683071879,
          "error": 10.039274683071879
        },
        {
          "frequency": 411.39193,
          "expected": 4.2408,
          "actual": 14.786728592780438,
          "error": 10.545928592780438
        },
        {
          "frequency": 419.41263,
          "expected": 4.2408,
          "actual": 15.325404740194461,
          "error": 11.084604740194461
        },
        {
          "frequency": 427.58972,
          "expected": 4.2408,
          "actual": 15.898562216931502,
          "error": 11.657762216931502
        },
        {
          "frequency": 435.92623,
          "expected": 4.2408,
          "actual": 16.508782665644933,
          "error": 12.267982665644933
        },
        {
          "frequency": 444.42527,
          "expected": 4.2408,
          "actual": 17.158890908251664,
          "error": 12.918090908251664
        },
        {
          "frequency": 453.09001,
          "expected": 4.2408,
          "actual": 17.85228896341484,
          "error": 13.611488963414839
        },
        {
          "frequency": 461.92368,
          "expected": 4.2408,
          "actual": 18.593393272919233,
          "error": 14.352593272919233
        },
        {
          "frequency": 470.92959,
          "expected": 4.2408,
          "actual": 19.387418017022465,
          "error": 15.146618017022465
        },
        {
          "frequency": 480.11107,
          "expected": 4.2408,
          "actual": 20.238755258138468,
          "error": 15.997955258138468
        },
        {
          "frequency": 489.47156,
          "expected": 4.2408,
          "actual": 21.149212312457212,
          "error": 16.908412312457212
        },
        {
          "frequency": 499.01455,
          "expected": 4.2408,
          "actual": 22.117890959382894,
          "error": 17.877090959382894
        },
        {
          "frequency": 508.74359,
          "expected": 4.2408,
          "actual": 23.14183326676562,
          "error": 18.90103326676562
        },
        {
          "frequency": 518.66232,
          "expected": 4.2408,
          "actual": 24.215838230503618,
          "error": 19.975038230503618
        },
        {
          "frequency": 528.77442,
          "expected": 4.2408,
          "actual": 25.33147045370085,
          "error": 21.09067045370085
        },
        {
          "frequency": 539.08368,
          "expected": 4.2408,
          "actual": 26.475935543915128,
          "error": 22.235135543915128
        },
        {
          "frequency": 549.59393,
          "expected": 4.555,
          "actual": 27.630824628500775,
          "error": 23.075824628500776
        },
        {
          "frequency": 560.3091,
          "expected": 4.555,
          "actual": 28.76975972552716,
          "error": 24.21475972552716
        },
        {
          "frequency": 571.23317,
          "expected": 4.3979,
          "actual": 29.855010657605387,
          "error": 25.457110657605387
        },
        {
          "frequency": 582.37022,
          "expected": 4.3979,
          "actual": 30.836983167268468,
          "error": 26.439083167268468
        },
        {
          "frequency": 593.72441,
          "expected": 4.555,
          "actual": 31.65881900446816,
          "error": 27.10381900446816
        },
        {
          "frequency": 605.29997,
          "expected": 4.555,
          "actual": 32.263476948532904,
          "error": 27.708476948532905
        },
        {
          "frequency": 617.1012,
          "expected": 4.3979,
          "actual": 32.60162962038022,
          "error": 28.203729620380223
        },
        {
          "frequency": 629.13253,
          "expected": 4.3979,
          "actual": 32.63990488396728,
          "error": 28.242004883967283
        },
        {
          "frequency": 641.39842,
          "expected": 4.555,
          "actual": 32.36755867446411,
          "error": 27.812558674464107
        },
        {
          "frequency": 653.90345,
          "expected": 4.555,
          "actual": 31.799154247571085,
          "error": 27.244154247571085
        },
        {
          "frequency": 666.65228,
          "expected": 4.555,
          "actual": 30.971977512096935,
          "error": 26.416977512096935
        },
        {
          "frequency": 679.64968,
          "expected": 4.555,
          "actual": 29.93882302059756,
          "error": 25.38382302059756
        },
        {
          "frequency": 692.90048,
          "expected": 4.555,
          "actual": 28.758835123504873,
          "error": 24.203835123504874
        },
        {
          "frequency": 706.40962,
          "expected": 4.555,
          "actual": 27.48915895871266,
          "error": 22.93415895871266
        },
        {
          "frequency": 720.18214,
          "expected": 4.555,
          "actual": 26.178546051347965,
          "error": 21.623546051347965
        },
        {
          "frequency": 734.22318,
          "expected": 4.555,
          "actual": 24.863840789635567,
          "error": 20.308840789635568
        },
        {
          "frequency": 748.53797,
          "expected": 4.555,
          "actual": 23.57171973412954,
          "error": 19.01671973412954
        },
        {
          "frequency": 763.13185,
          "expected": 4.555,
          "actual": 22.322551903759717,
          "error": 17.767551903759717
        },
        {
          "frequency": 778.01026,
          "expected": 4.555,
          "actual": 21.13058064553727,
          "error": 16.57558064553727
        },
        {
          "frequency": 793.17875,
          "expected": 4.555,
          "actual": 20.003690162146338,
          "error": 15.448690162146338
        },
        {
          "frequency": 808.64297,
          "expected": 4.555,
          "actual": 18.944755828683128,
          "error": 14.389755828683128
        },
        {
          "frequency": 824.40868,
          "expected": 4.555,
          "actual": 17.953262291405977,
          "error": 13.398262291405977
        },
        {
          "frequency": 840.48178,
          "expected": 4.555,
          "actual": 17.027022460695555,
          "error": 12.472022460695555
        },
        {
          "frequency": 856.86824,
          "expected": 4.555,
          "actual": 16.16311415644019,
          "error": 11.608114156440191
        },
        {
          "frequency": 873.57418,
          "expected": 4.712,
          "actual": 15.35796452538317,
          "error": 10.645964525383171
        },
        {
          "frequency": 890.60583,
          "expected": 4.712,
          "actual": 14.607606356208223,
          "error": 9.895606356208223
        },
        {
          "frequency": 907.96954,
          "expected": 4.8691,
          "actual": 13.907979451003259,
          "error": 9.038879451003258
        },
        {
          "frequency": 925.67178,
          "expected": 4.8691,
          "actual": 13.255162702116742,
          "error": 8.386062702116742
        },
        {
          "frequency": 943.71915,
          "expected": 4.712,
          "actual": 12.645488125473562,
          "error": 7.933488125473563
        },
        {
          "frequency": 962.11838,
          "expected": 4.8691,
          "actual": 12.075514226540859,
          "error": 7.206414226540859
        },
        {
          "frequency": 980.87633,
          "expected": 4.712,
          "actual": 11.541987664147815,
          "error": 6.829987664147815
        }
      ],
      "peaks": [
        {
          "reference": {
            "frequency": 20.62839,
            "height": 29.8429,
            "prominence": 25.2879,
            "halfProminenceWidthHz": 3.438158265122258
          },
          "actual": null,
          "frequencyErrorPercent": null,
          "heightError": null
        },
        {
          "reference": {
            "frequency": 48.24343,
            "height": 40.9948,
            "prominence": 36.754,
            "halfProminenceWidthHz": 5.3474806179280705
          },
          "actual": {
            "frequency": 44.65758,
            "height": 17.720340100366734,
            "prominence": 12.514549743134285,
            "halfProminenceWidthHz": 16.109181692309534
          },
          "frequencyErrorPercent": -7.432825568165436,
          "heightError": -23.274459899633264
        }
      ],
      "rmse": 9.935111426408854,
      "maxError": 28.242004883967283,
      "issues": [
        "The reference is empty but model attenuation is nonzero.",
        "Crossover conditions differ.",
        "Reference extends above the radiation/plane-wave model limits."
      ],
      "status": "incompatible"
    },
    {
      "id": "fig16-solid-z",
      "title": "Figure16 stuffed TL calculated solid impedance (approximate embedded-raster extraction)",
      "source": "Martin J. King, 2023-09-23 Satori TL report, Figure16; original embedded586x293 JPEG; scripts/extract-satori-impedance.py",
      "evidence": "published-simulation",
      "trace": "calculated-solid",
      "frequencyUncertaintyPercent": 2,
      "metric": "impedance",
      "conditions": {
        "voltage": null,
        "distanceM": null,
        "radiation": "near-field",
        "stuffing": "stuffed",
        "crossover": "bypass",
        "notes": "Approximate solid-curve extraction using contiguous red strokes. Dashed measured curve is separate and is not used as a calculated target. Inspect extraction overlay; dense raster samples are correlated."
      },
      "tolerance": 2,
      "uncertainty": 1,
      "rows": [
        {
          "frequency": 10.09701,
          "expected": 4.555,
          "actual": 5.2284904992221914,
          "error": 0.6734904992221917
        },
        {
          "frequency": 10.29387,
          "expected": 4.555,
          "actual": 5.275075770286237,
          "error": 0.720075770286237
        },
        {
          "frequency": 10.49456,
          "expected": 4.555,
          "actual": 5.323245093054173,
          "error": 0.7682450930541735
        },
        {
          "frequency": 10.69917,
          "expected": 4.8691,
          "actual": 5.3730063829446735,
          "error": 0.503906382944673
        },
        {
          "frequency": 10.90777,
          "expected": 4.8691,
          "actual": 5.424355094764138,
          "error": 0.5552550947641377
        },
        {
          "frequency": 11.12043,
          "expected": 4.8691,
          "actual": 5.477277975330911,
          "error": 0.6081779753309107
        },
        {
          "frequency": 11.33724,
          "expected": 4.8691,
          "actual": 5.531757138844067,
          "error": 0.6626571388440663
        },
        {
          "frequency": 11.55828,
          "expected": 4.8691,
          "actual": 5.587761646818845,
          "error": 0.7186616468188447
        },
        {
          "frequency": 11.78362,
          "expected": 5.1832,
          "actual": 5.645246381724055,
          "error": 0.462046381724055
        },
        {
          "frequency": 12.01336,
          "expected": 5.1832,
          "actual": 5.704161280840779,
          "error": 0.5209612808407789
        },
        {
          "frequency": 12.24758,
          "expected": 5.1832,
          "actual": 5.764437669313851,
          "error": 0.5812376693138503
        },
        {
          "frequency": 12.48637,
          "expected": 5.4974,
          "actual": 5.825995043361818,
          "error": 0.3285950433618181
        },
        {
          "frequency": 12.72981,
          "expected": 5.6545,
          "actual": 5.888735194643689,
          "error": 0.23423519464368958
        },
        {
          "frequency": 12.97799,
          "expected": 5.6545,
          "actual": 5.95254680305306,
          "error": 0.29804680305306075
        },
        {
          "frequency": 13.23102,
          "expected": 5.4974,
          "actual": 6.017307614885087,
          "error": 0.5199076148850867
        },
        {
          "frequency": 13.48898,
          "expected": 5.8115,
          "actual": 6.082871506311857,
          "error": 0.2713715063118576
        },
        {
          "frequency": 13.75197,
          "expected": 5.9686,
          "actual": 6.149081546496968,
          "error": 0.18048154649696801
        },
        {
          "frequency": 14.02008,
          "expected": 6.2827,
          "actual": 6.215762974234455,
          "error": -0.0669370257655455
        },
        {
          "frequency": 14.29342,
          "expected": 6.1257,
          "actual": 6.2827317344025335,
          "error": 0.15703173440253337
        },
        {
          "frequency": 14.5721,
          "expected": 6.4398,
          "actual": 6.349790857061801,
          "error": -0.09000914293819928
        },
        {
          "frequency": 14.8562,
          "expected": 6.7539,
          "actual": 6.4167254944271495,
          "error": -0.33717450557285034
        },
        {
          "frequency": 15.14584,
          "expected": 6.911,
          "actual": 6.483322295797795,
          "error": -0.4276777042022042
        },
        {
          "frequency": 15.44114,
          "expected": 6.7539,
          "actual": 6.549362634983054,
          "error": -0.20453736501694575
        },
        {
          "frequency": 15.74218,
          "expected": 7.0681,
          "actual": 6.614617762828993,
          "error": -0.45348223717100744
        },
        {
          "frequency": 16.0491,
          "expected": 7.3822,
          "actual": 6.678875105911095,
          "error": -0.7033248940889054
        },
        {
          "frequency": 16.362,
          "expected": 7.6963,
          "actual": 6.741920967245417,
          "error": -0.9543790327545834
        },
        {
          "frequency": 16.68101,
          "expected": 7.6963,
          "actual": 6.803560420490724,
          "error": -0.8927395795092758
        },
        {
          "frequency": 17.00623,
          "expected": 7.6963,
          "actual": 6.863610566264032,
          "error": -0.8326894337359683
        },
        {
          "frequency": 17.33779,
          "expected": 8.3246,
          "actual": 6.921917556882996,
          "error": -1.402682443117004
        },
        {
          "frequency": 17.67582,
          "expected": 8.3246,
          "actual": 6.97835578770512,
          "error": -1.34624421229488
        },
        {
          "frequency": 18.02043,
          "expected": 8.3246,
          "actual": 7.032829987750866,
          "error": -1.2917700122491338
        },
        {
          "frequency": 18.37177,
          "expected": 8.6387,
          "actual": 7.085289591539227,
          "error": -1.5534104084607732
        },
        {
          "frequency": 18.72995,
          "expected": 8.7958,
          "actual": 7.135720363309468,
          "error": -1.660079636690532
        },
        {
          "frequency": 19.09512,
          "expected": 8.7958,
          "actual": 7.184159982118356,
          "error": -1.6116400178816441
        },
        {
          "frequency": 19.46741,
          "expected": 8.6387,
          "actual": 7.230692063055612,
          "error": -1.4080079369443883
        },
        {
          "frequency": 19.84696,
          "expected": 8.6387,
          "actual": 7.275452451999103,
          "error": -1.3632475480008974
        },
        {
          "frequency": 20.2339,
          "expected": 8.4817,
          "actual": 7.318627999971722,
          "error": -1.1630720000282784
        },
        {
          "frequency": 20.62839,
          "expected": 8.4817,
          "actual": 7.360461497035561,
          "error": -1.121238502964439
        },
        {
          "frequency": 21.03058,
          "expected": 8.6387,
          "actual": 7.40124681457432,
          "error": -1.2374531854256796
        },
        {
          "frequency": 21.4406,
          "expected": 8.3246,
          "actual": 7.441327554359749,
          "error": -0.8832724456402516
        },
        {
          "frequency": 21.85862,
          "expected": 8.0105,
          "actual": 7.481101858946239,
          "error": -0.5293981410537612
        },
        {
          "frequency": 22.28478,
          "expected": 7.8534,
          "actual": 7.5210141921291225,
          "error": -0.33238580787087724
        },
        {
          "frequency": 22.71926,
          "expected": 8.0105,
          "actual": 7.561560770515034,
          "error": -0.44893922948496634
        },
        {
          "frequency": 23.1622,
          "expected": 7.8534,
          "actual": 7.603281013116861,
          "error": -0.2501189868831384
        },
        {
          "frequency": 23.61379,
          "expected": 7.6963,
          "actual": 7.646765441751826,
          "error": -0.04953455824817432
        },
        {
          "frequency": 24.07417,
          "expected": 7.2251,
          "actual": 7.692646270114543,
          "error": 0.46754627011454275
        },
        {
          "frequency": 24.54353,
          "expected": 7.3822,
          "actual": 7.741608009839894,
          "error": 0.3594080098398935
        },
        {
          "frequency": 25.02205,
          "expected": 7.3822,
          "actual": 7.79438390532337,
          "error": 0.4121839053233698
        },
        {
          "frequency": 25.50989,
          "expected": 6.7539,
          "actual": 7.851757798024846,
          "error": 1.0978577980248465
        },
        {
          "frequency": 26.00724,
          "expected": 7.0681,
          "actual": 7.914574512174374,
          "error": 0.8464745121743737
        },
        {
          "frequency": 26.51429,
          "expected": 7.0681,
          "actual": 7.983743325653278,
          "error": 0.9156433256532779
        },
        {
          "frequency": 27.03123,
          "expected": 7.0681,
          "actual": 8.060246332622858,
          "error": 0.9921463326228581
        },
        {
          "frequency": 27.55825,
          "expected": 7.0681,
          "actual": 8.14514887408298,
          "error": 1.077048874082979
        },
        {
          "frequency": 28.09554,
          "expected": 6.5969,
          "actual": 8.239612286332054,
          "error": 1.6427122863320545
        },
        {
          "frequency": 28.6433,
          "expected": 6.7539,
          "actual": 8.344911249131574,
          "error": 1.591011249131574
        },
        {
          "frequency": 29.20175,
          "expected": 6.7539,
          "actual": 8.462455163442531,
          "error": 1.708555163442531
        },
        {
          "frequency": 29.77108,
          "expected": 6.5969,
          "actual": 8.593799788836945,
          "error": 1.996899788836945
        },
        {
          "frequency": 30.35151,
          "expected": 7.0681,
          "actual": 8.740685104401043,
          "error": 1.6725851044010431
        },
        {
          "frequency": 30.94326,
          "expected": 7.0681,
          "actual": 8.905058922138293,
          "error": 1.836958922138293
        },
        {
          "frequency": 31.54654,
          "expected": 7.0681,
          "actual": 9.089106450700427,
          "error": 2.021006450700427
        },
        {
          "frequency": 32.16159,
          "expected": 7.3822,
          "actual": 9.295298659489477,
          "error": 1.913098659489477
        },
        {
          "frequency": 32.78863,
          "expected": 7.3822,
          "actual": 9.526415585750323,
          "error": 2.144215585750323
        },
        {
          "frequency": 33.42789,
          "expected": 7.6963,
          "actual": 9.7855926104993,
          "error": 2.0892926104993004
        },
        {
          "frequency": 34.07962,
          "expected": 7.6963,
          "actual": 10.076357591659741,
          "error": 2.3800575916597415
        },
        {
          "frequency": 34.74405,
          "expected": 8.0105,
          "actual": 10.402629491039542,
          "error": 2.392129491039542
        },
        {
          "frequency": 35.42144,
          "expected": 8.3246,
          "actual": 10.768723476900043,
          "error": 2.4441234769000424
        },
        {
          "frequency": 36.11204,
          "expected": 8.7958,
          "actual": 11.179252274136468,
          "error": 2.3834522741364683
        },
        {
          "frequency": 36.8161,
          "expected": 9.4241,
          "actual": 11.638935900595172,
          "error": 2.2148359005951725
        },
        {
          "frequency": 37.53388,
          "expected": 10.0524,
          "actual": 12.15221945100578,
          "error": 2.0998194510057804
        },
        {
          "frequency": 38.26566,
          "expected": 10.6806,
          "actual": 12.72257044288167,
          "error": 2.04197044288167
        },
        {
          "frequency": 39.01171,
          "expected": 11.3089,
          "actual": 13.351228228298258,
          "error": 2.042328228298258
        },
        {
          "frequency": 39.7723,
          "expected": 12.2513,
          "actual": 14.035204317163014,
          "error": 1.7839043171630138
        },
        {
          "frequency": 40.54772,
          "expected": 13.3508,
          "actual": 14.764248470980698,
          "error": 1.4134484709806987
        },
        {
          "frequency": 41.33826,
          "expected": 14.6073,
          "actual": 15.51663018834496,
          "error": 0.9093301883449598
        },
        {
          "frequency": 42.14421,
          "expected": 16.0209,
          "actual": 16.254306737167038,
          "error": 0.2334067371670372
        },
        {
          "frequency": 42.96588,
          "expected": 17.2775,
          "actual": 16.91938025611882,
          "error": -0.3581197438811792
        },
        {
          "frequency": 43.80356,
          "expected": 18.534,
          "actual": 17.435668225276448,
          "error": -1.098331774723551
        },
        {
          "frequency": 44.65758,
          "expected": 15.8639,
          "actual": 17.720340100366734,
          "error": 1.8564401003667346
        },
        {
          "frequency": 45.52825,
          "expected": 19.9476,
          "actual": 17.70667320723776,
          "error": -2.2409267927622416
        },
        {
          "frequency": 46.41589,
          "expected": 19.1623,
          "actual": 17.36980280296509,
          "error": -1.7924971970349084
        },
        {
          "frequency": 47.32084,
          "expected": 18.534,
          "actual": 16.73933770293421,
          "error": -1.7946622970657877
        },
        {
          "frequency": 48.24343,
          "expected": 17.2775,
          "actual": 15.888940044853642,
          "error": -1.3885599551463574
        },
        {
          "frequency": 49.18401,
          "expected": 15.8639,
          "actual": 14.909976377600875,
          "error": -0.9539236223991239
        },
        {
          "frequency": 50.14292,
          "expected": 14.4503,
          "actual": 13.886131736295097,
          "error": -0.5641682637049037
        },
        {
          "frequency": 51.12053,
          "expected": 13.1937,
          "actual": 12.879709995384594,
          "error": -0.3139900046154054
        },
        {
          "frequency": 52.11721,
          "expected": 12.2513,
          "actual": 11.929698775288498,
          "error": -0.3216012247115021
        },
        {
          "frequency": 53.13331,
          "expected": 13.9791,
          "actual": 11.0561730296593,
          "error": -2.9229269703407006
        },
        {
          "frequency": 54.16922,
          "expected": 10.5236,
          "actual": 10.266207497758502,
          "error": -0.25739250224149757
        },
        {
          "frequency": 55.22534,
          "expected": 9.8953,
          "actual": 9.559043054203336,
          "error": -0.33625694579666465
        },
        {
          "frequency": 56.30204,
          "expected": 9.1099,
          "actual": 8.929751497862886,
          "error": -0.1801485021371132
        },
        {
          "frequency": 57.39973,
          "expected": 9.267,
          "actual": 8.37149695589164,
          "error": -0.8955030441083593
        },
        {
          "frequency": 58.51883,
          "expected": 8.1675,
          "actual": 7.8769079159775455,
          "error": -0.29059208402245496
        },
        {
          "frequency": 59.65974,
          "expected": 8.1675,
          "actual": 7.438813836265032,
          "error": -0.7286861637349684
        },
        {
          "frequency": 60.82289,
          "expected": 8.3246,
          "actual": 7.050573879704083,
          "error": -1.2740261202959173
        },
        {
          "frequency": 62.00873,
          "expected": 7.0681,
          "actual": 6.706223052106745,
          "error": -0.3618769478932551
        },
        {
          "frequency": 63.21768,
          "expected": 6.911,
          "actual": 6.400507937229515,
          "error": -0.510492062770485
        },
        {
          "frequency": 64.45021,
          "expected": 6.7539,
          "actual": 6.12882769441905,
          "error": -0.6250723055809502
        },
        {
          "frequency": 65.70676,
          "expected": 6.2827,
          "actual": 5.887193135428371,
          "error": -0.39550686457162954
        },
        {
          "frequency": 66.98781,
          "expected": 6.2827,
          "actual": 5.6721408478812005,
          "error": -0.6105591521187996
        },
        {
          "frequency": 68.29384,
          "expected": 6.1257,
          "actual": 5.480673619478856,
          "error": -0.645026380521144
        },
        {
          "frequency": 69.62533,
          "expected": 5.8115,
          "actual": 5.310195879847245,
          "error": -0.5013041201527546
        },
        {
          "frequency": 70.98279,
          "expected": 5.6545,
          "actual": 5.158453378910607,
          "error": -0.496046621089393
        },
        {
          "frequency": 72.3667,
          "expected": 5.6545,
          "actual": 5.023491007601677,
          "error": -0.6310089923983222
        },
        {
          "frequency": 73.7776,
          "expected": 5.3403,
          "actual": 4.903600854302927,
          "error": -0.436699145697073
        },
        {
          "frequency": 75.21601,
          "expected": 5.1832,
          "actual": 4.797294656567433,
          "error": -0.385905343432567
        },
        {
          "frequency": 76.68246,
          "expected": 5.1832,
          "actual": 4.703269700619939,
          "error": -0.4799302993800616
        },
        {
          "frequency": 78.1775,
          "expected": 5.0262,
          "actual": 4.620382431068676,
          "error": -0.40581756893132415
        },
        {
          "frequency": 79.70169,
          "expected": 4.8691,
          "actual": 4.547627329177911,
          "error": -0.3214726708220894
        },
        {
          "frequency": 81.25559,
          "expected": 4.8691,
          "actual": 4.484118624643168,
          "error": -0.3849813753568325
        },
        {
          "frequency": 82.83979,
          "expected": 4.8691,
          "actual": 4.429073218822376,
          "error": -0.4400267811776244
        },
        {
          "frequency": 84.45488,
          "expected": 4.712,
          "actual": 4.381798619624815,
          "error": -0.33020138037518443
        },
        {
          "frequency": 86.10145,
          "expected": 4.555,
          "actual": 4.3416812062960055,
          "error": -0.2133187937039942
        },
        {
          "frequency": 87.78013,
          "expected": 4.555,
          "actual": 4.308175546529236,
          "error": -0.24682445347076332
        },
        {
          "frequency": 89.49154,
          "expected": 4.555,
          "actual": 4.280797367871294,
          "error": -0.27420263212870566
        },
        {
          "frequency": 91.23631,
          "expected": 4.555,
          "actual": 4.25911577199795,
          "error": -0.2958842280020493
        },
        {
          "frequency": 93.0151,
          "expected": 4.555,
          "actual": 4.242746928005483,
          "error": -0.31225307199451713
        },
        {
          "frequency": 94.82857,
          "expected": 4.3979,
          "actual": 4.231349173007609,
          "error": -0.166550826992391
        },
        {
          "frequency": 96.6774,
          "expected": 4.2408,
          "actual": 4.224618143654308,
          "error": -0.016181856345691692
        },
        {
          "frequency": 98.56227,
          "expected": 4.2408,
          "actual": 4.222282784392104,
          "error": -0.018517215607896098
        },
        {
          "frequency": 100.48389,
          "expected": 4.2408,
          "actual": 4.224101613227983,
          "error": -0.01669838677201696
        },
        {
          "frequency": 102.44297,
          "expected": 4.2408,
          "actual": 4.229859467775791,
          "error": -0.01094053222420932
        },
        {
          "frequency": 104.44026,
          "expected": 4.2408,
          "actual": 4.239364537587613,
          "error": -0.001435462412387345
        },
        {
          "frequency": 106.47648,
          "expected": 4.2408,
          "actual": 4.252445213722569,
          "error": 0.011645213722569103
        },
        {
          "frequency": 108.5524,
          "expected": 4.2408,
          "actual": 4.268947743260489,
          "error": 0.0281477432604893
        },
        {
          "frequency": 110.66879,
          "expected": 4.2408,
          "actual": 4.288733499043802,
          "error": 0.047933499043802286
        },
        {
          "frequency": 112.82644,
          "expected": 4.2408,
          "actual": 4.311676845077986,
          "error": 0.07087684507798553
        },
        {
          "frequency": 115.02617,
          "expected": 4.2408,
          "actual": 4.337663361527045,
          "error": 0.09686336152704467
        },
        {
          "frequency": 117.26878,
          "expected": 4.0838,
          "actual": 4.366587728384933,
          "error": 0.2827877283849327
        },
        {
          "frequency": 119.55511,
          "expected": 4.0838,
          "actual": 4.398353352117721,
          "error": 0.31455335211772084
        },
        {
          "frequency": 121.88602,
          "expected": 3.9267,
          "actual": 4.432871606554715,
          "error": 0.5061716065547155
        },
        {
          "frequency": 124.26237,
          "expected": 3.9267,
          "actual": 4.470061361583023,
          "error": 0.5433613615830235
        },
        {
          "frequency": 126.68505,
          "expected": 3.9267,
          "actual": 4.509849549760858,
          "error": 0.5831495497608583
        },
        {
          "frequency": 129.15497,
          "expected": 3.9267,
          "actual": 4.552171305954833,
          "error": 0.6254713059548336
        },
        {
          "frequency": 131.67304,
          "expected": 3.9267,
          "actual": 4.596969853645604,
          "error": 0.6702698536456038
        },
        {
          "frequency": 134.2402,
          "expected": 3.9267,
          "actual": 4.6441971070546355,
          "error": 0.7174971070546357
        },
        {
          "frequency": 136.85742,
          "expected": 3.9267,
          "actual": 4.693813585277657,
          "error": 0.7671135852776572
        },
        {
          "frequency": 139.52566,
          "expected": 3.9267,
          "actual": 4.745787286377784,
          "error": 0.8190872863777838
        },
        {
          "frequency": 142.24592,
          "expected": 3.9267,
          "actual": 4.800094032639079,
          "error": 0.8733940326390788
        },
        {
          "frequency": 145.01922,
          "expected": 3.9267,
          "actual": 4.856716322723345,
          "error": 0.9300163227233456
        },
        {
          "frequency": 147.84659,
          "expected": 3.9267,
          "actual": 4.915642175905889,
          "error": 0.9889421759058892
        },
        {
          "frequency": 150.72909,
          "expected": 3.9267,
          "actual": 4.976864460010815,
          "error": 1.0501644600108153
        },
        {
          "frequency": 153.66778,
          "expected": 3.9267,
          "actual": 5.040379047004136,
          "error": 1.1136790470041364
        },
        {
          "frequency": 156.66376,
          "expected": 3.9267,
          "actual": 5.1061843136674065,
          "error": 1.1794843136674067
        },
        {
          "frequency": 159.71816,
          "expected": 3.9267,
          "actual": 5.174279445648901,
          "error": 1.2475794456489013
        },
        {
          "frequency": 162.83211,
          "expected": 3.9267,
          "actual": 5.244662094988837,
          "error": 1.3179620949888373
        },
        {
          "frequency": 166.00676,
          "expected": 3.9267,
          "actual": 5.317326993178219,
          "error": 1.3906269931782194
        },
        {
          "frequency": 169.24332,
          "expected": 3.9267,
          "actual": 5.3922650274131625,
          "error": 1.4655650274131626
        },
        {
          "frequency": 172.54297,
          "expected": 3.9267,
          "actual": 5.469459529851697,
          "error": 1.5427595298516974
        },
        {
          "frequency": 175.90696,
          "expected": 3.9267,
          "actual": 5.548887666647045,
          "error": 1.622187666647045
        },
        {
          "frequency": 179.33653,
          "expected": 3.9267,
          "actual": 5.630519262324761,
          "error": 1.7038192623247608
        },
        {
          "frequency": 182.83297,
          "expected": 3.9267,
          "actual": 5.714321900434421,
          "error": 1.7876219004344214
        },
        {
          "frequency": 186.39757,
          "expected": 3.9267,
          "actual": 5.8002683172834795,
          "error": 1.8735683172834796
        },
        {
          "frequency": 190.03167,
          "expected": 3.9267,
          "actual": 5.8883531074504365,
          "error": 1.9616531074504366
        },
        {
          "frequency": 193.73663,
          "expected": 3.9267,
          "actual": 5.97861558007715,
          "error": 2.0519155800771505
        },
        {
          "frequency": 197.51382,
          "expected": 3.9267,
          "actual": 6.07116950489115,
          "error": 2.1444695048911497
        },
        {
          "frequency": 201.36465,
          "expected": 3.9267,
          "actual": 6.166233603911328,
          "error": 2.2395336039113283
        },
        {
          "frequency": 205.29056,
          "expected": 3.9267,
          "actual": 6.264148511546075,
          "error": 2.3374485115460755
        },
        {
          "frequency": 209.29301,
          "expected": 3.9267,
          "actual": 6.36536688418534,
          "error": 2.43866688418534
        },
        {
          "frequency": 213.37349,
          "expected": 3.9267,
          "actual": 6.470409835394671,
          "error": 2.543709835394671
        },
        {
          "frequency": 217.53353,
          "expected": 3.9267,
          "actual": 6.579797812818286,
          "error": 2.653097812818286
        },
        {
          "frequency": 221.77467,
          "expected": 3.9267,
          "actual": 6.693979041809804,
          "error": 2.7672790418098043
        },
        {
          "frequency": 226.09851,
          "expected": 3.9267,
          "actual": 6.81328546700787,
          "error": 2.8865854670078703
        },
        {
          "frequency": 230.50664,
          "expected": 3.9267,
          "actual": 6.937923959603758,
          "error": 3.011223959603758
        },
        {
          "frequency": 235.00071,
          "expected": 3.9267,
          "actual": 7.068003734769965,
          "error": 3.141303734769965
        },
        {
          "frequency": 239.58241,
          "expected": 3.9267,
          "actual": 7.203576255882386,
          "error": 3.2768762558823865
        },
        {
          "frequency": 244.25343,
          "expected": 3.9267,
          "actual": 7.34467244818176,
          "error": 3.4179724481817604
        },
        {
          "frequency": 249.01552,
          "expected": 3.9267,
          "actual": 7.491331440709598,
          "error": 3.5646314407095985
        },
        {
          "frequency": 253.87045,
          "expected": 3.9267,
          "actual": 7.643613119489467,
          "error": 3.7169131194894676
        },
        {
          "frequency": 258.82004,
          "expected": 4.0838,
          "actual": 7.8016024946156195,
          "error": 3.7178024946156194
        },
        {
          "frequency": 263.86613,
          "expected": 4.2408,
          "actual": 7.965407072615497,
          "error": 3.7246070726154965
        },
        {
          "frequency": 269.0106,
          "expected": 4.2408,
          "actual": 8.135157317823795,
          "error": 3.894357317823795
        },
        {
          "frequency": 274.25537,
          "expected": 4.0838,
          "actual": 8.311016708371183,
          "error": 4.2272167083711825
        },
        {
          "frequency": 279.60239,
          "expected": 4.0838,
          "actual": 8.493212304177794,
          "error": 4.409412304177794
        },
        {
          "frequency": 285.05366,
          "expected": 4.2408,
          "actual": 8.68209544589887,
          "error": 4.44129544589887
        },
        {
          "frequency": 290.61121,
          "expected": 4.2408,
          "actual": 8.878223487717245,
          "error": 4.637423487717244
        },
        {
          "frequency": 296.27712,
          "expected": 4.0838,
          "actual": 9.08242720719448,
          "error": 4.998627207194479
        },
        {
          "frequency": 302.05349,
          "expected": 4.2408,
          "actual": 9.295796263268148,
          "error": 5.054996263268148
        },
        {
          "frequency": 307.94248,
          "expected": 4.2408,
          "actual": 9.519549883252594,
          "error": 5.278749883252594
        },
        {
          "frequency": 313.94628,
          "expected": 4.2408,
          "actual": 9.7548429190037,
          "error": 5.5140429190037
        },
        {
          "frequency": 320.06714,
          "expected": 4.2408,
          "actual": 10.002634377413347,
          "error": 5.761834377413347
        },
        {
          "frequency": 326.30733,
          "expected": 4.2408,
          "actual": 10.263687146530605,
          "error": 6.022887146530605
        },
        {
          "frequency": 332.66919,
          "expected": 4.2408,
          "actual": 10.538671238521049,
          "error": 6.297871238521049
        },
        {
          "frequency": 339.15508,
          "expected": 4.2408,
          "actual": 10.828281147919594,
          "error": 6.587481147919593
        },
        {
          "frequency": 345.76742,
          "expected": 4.2408,
          "actual": 11.133323123666196,
          "error": 6.892523123666196
        },
        {
          "frequency": 352.50868,
          "expected": 4.2408,
          "actual": 11.454759578521108,
          "error": 7.2139595785211075
        },
        {
          "frequency": 359.38137,
          "expected": 4.2408,
          "actual": 11.79372724810287,
          "error": 7.55292724810287
        },
        {
          "frequency": 366.38805,
          "expected": 4.2408,
          "actual": 12.151543482732258,
          "error": 7.910743482732258
        },
        {
          "frequency": 373.53134,
          "expected": 4.2408,
          "actual": 12.529700694151956,
          "error": 8.288900694151955
        },
        {
          "frequency": 380.8139,
          "expected": 4.2408,
          "actual": 12.92983765017693,
          "error": 8.68903765017693
        },
        {
          "frequency": 388.23844,
          "expected": 4.2408,
          "actual": 13.353697360412207,
          "error": 9.112897360412207
        },
        {
          "frequency": 395.80773,
          "expected": 4.2408,
          "actual": 13.803117190495998,
          "error": 9.562317190495998
        },
        {
          "frequency": 403.5246,
          "expected": 4.2408,
          "actual": 14.280074683071879,
          "error": 10.039274683071879
        },
        {
          "frequency": 411.39193,
          "expected": 4.2408,
          "actual": 14.786728592780438,
          "error": 10.545928592780438
        },
        {
          "frequency": 419.41263,
          "expected": 4.2408,
          "actual": 15.325404740194461,
          "error": 11.084604740194461
        },
        {
          "frequency": 427.58972,
          "expected": 4.2408,
          "actual": 15.898562216931502,
          "error": 11.657762216931502
        },
        {
          "frequency": 435.92623,
          "expected": 4.2408,
          "actual": 16.508782665644933,
          "error": 12.267982665644933
        },
        {
          "frequency": 444.42527,
          "expected": 4.2408,
          "actual": 17.158890908251664,
          "error": 12.918090908251664
        },
        {
          "frequency": 453.09001,
          "expected": 4.2408,
          "actual": 17.85228896341484,
          "error": 13.611488963414839
        },
        {
          "frequency": 461.92368,
          "expected": 4.2408,
          "actual": 18.593393272919233,
          "error": 14.352593272919233
        },
        {
          "frequency": 470.92959,
          "expected": 4.2408,
          "actual": 19.387418017022465,
          "error": 15.146618017022465
        },
        {
          "frequency": 480.11107,
          "expected": 4.2408,
          "actual": 20.238755258138468,
          "error": 15.997955258138468
        },
        {
          "frequency": 489.47156,
          "expected": 4.2408,
          "actual": 21.149212312457212,
          "error": 16.908412312457212
        },
        {
          "frequency": 499.01455,
          "expected": 4.2408,
          "actual": 22.117890959382894,
          "error": 17.877090959382894
        },
        {
          "frequency": 508.74359,
          "expected": 4.2408,
          "actual": 23.14183326676562,
          "error": 18.90103326676562
        },
        {
          "frequency": 518.66232,
          "expected": 4.2408,
          "actual": 24.215838230503618,
          "error": 19.975038230503618
        },
        {
          "frequency": 528.77442,
          "expected": 4.2408,
          "actual": 25.33147045370085,
          "error": 21.09067045370085
        },
        {
          "frequency": 539.08368,
          "expected": 4.2408,
          "actual": 26.475935543915128,
          "error": 22.235135543915128
        },
        {
          "frequency": 549.59393,
          "expected": 4.3979,
          "actual": 27.630824628500775,
          "error": 23.232924628500776
        },
        {
          "frequency": 560.3091,
          "expected": 4.3979,
          "actual": 28.76975972552716,
          "error": 24.37185972552716
        },
        {
          "frequency": 571.23317,
          "expected": 4.555,
          "actual": 29.855010657605387,
          "error": 25.300010657605387
        },
        {
          "frequency": 582.37022,
          "expected": 4.555,
          "actual": 30.836983167268468,
          "error": 26.281983167268468
        },
        {
          "frequency": 593.72441,
          "expected": 4.3979,
          "actual": 31.65881900446816,
          "error": 27.26091900446816
        },
        {
          "frequency": 605.29997,
          "expected": 4.3979,
          "actual": 32.263476948532904,
          "error": 27.865576948532905
        },
        {
          "frequency": 617.1012,
          "expected": 4.555,
          "actual": 32.60162962038022,
          "error": 28.046629620380223
        },
        {
          "frequency": 629.13253,
          "expected": 4.3979,
          "actual": 32.63990488396728,
          "error": 28.242004883967283
        },
        {
          "frequency": 641.39842,
          "expected": 4.555,
          "actual": 32.36755867446411,
          "error": 27.812558674464107
        },
        {
          "frequency": 653.90345,
          "expected": 4.555,
          "actual": 31.799154247571085,
          "error": 27.244154247571085
        },
        {
          "frequency": 666.65228,
          "expected": 4.555,
          "actual": 30.971977512096935,
          "error": 26.416977512096935
        },
        {
          "frequency": 679.64968,
          "expected": 4.555,
          "actual": 29.93882302059756,
          "error": 25.38382302059756
        },
        {
          "frequency": 692.90048,
          "expected": 4.555,
          "actual": 28.758835123504873,
          "error": 24.203835123504874
        },
        {
          "frequency": 706.40962,
          "expected": 4.555,
          "actual": 27.48915895871266,
          "error": 22.93415895871266
        },
        {
          "frequency": 720.18214,
          "expected": 4.555,
          "actual": 26.178546051347965,
          "error": 21.623546051347965
        },
        {
          "frequency": 734.22318,
          "expected": 4.555,
          "actual": 24.863840789635567,
          "error": 20.308840789635568
        },
        {
          "frequency": 748.53797,
          "expected": 4.555,
          "actual": 23.57171973412954,
          "error": 19.01671973412954
        },
        {
          "frequency": 763.13185,
          "expected": 4.555,
          "actual": 22.322551903759717,
          "error": 17.767551903759717
        },
        {
          "frequency": 778.01026,
          "expected": 4.555,
          "actual": 21.13058064553727,
          "error": 16.57558064553727
        },
        {
          "frequency": 793.17875,
          "expected": 4.555,
          "actual": 20.003690162146338,
          "error": 15.448690162146338
        },
        {
          "frequency": 808.64297,
          "expected": 4.555,
          "actual": 18.944755828683128,
          "error": 14.389755828683128
        },
        {
          "frequency": 824.40868,
          "expected": 4.555,
          "actual": 17.953262291405977,
          "error": 13.398262291405977
        },
        {
          "frequency": 840.48178,
          "expected": 4.555,
          "actual": 17.027022460695555,
          "error": 12.472022460695555
        },
        {
          "frequency": 856.86824,
          "expected": 4.555,
          "actual": 16.16311415644019,
          "error": 11.608114156440191
        },
        {
          "frequency": 873.57418,
          "expected": 4.712,
          "actual": 15.35796452538317,
          "error": 10.645964525383171
        },
        {
          "frequency": 890.60583,
          "expected": 4.8691,
          "actual": 14.607606356208223,
          "error": 9.738506356208223
        },
        {
          "frequency": 907.96954,
          "expected": 4.8691,
          "actual": 13.907979451003259,
          "error": 9.038879451003258
        },
        {
          "frequency": 925.67178,
          "expected": 4.712,
          "actual": 13.255162702116742,
          "error": 8.543162702116742
        },
        {
          "frequency": 943.71915,
          "expected": 4.8691,
          "actual": 12.645488125473562,
          "error": 7.776388125473562
        },
        {
          "frequency": 962.11838,
          "expected": 4.8691,
          "actual": 12.075514226540859,
          "error": 7.206414226540859
        },
        {
          "frequency": 980.87633,
          "expected": 4.8691,
          "actual": 11.541987664147815,
          "error": 6.672887664147814
        }
      ],
      "peaks": [
        {
          "reference": {
            "frequency": 18.72995,
            "height": 8.7958,
            "prominence": 2.1989,
            "halfProminenceWidthHz": 6.607388749838137
          },
          "actual": null,
          "frequencyErrorPercent": null,
          "heightError": null
        },
        {
          "reference": {
            "frequency": 45.52825,
            "height": 19.9476,
            "prominence": 15.392600000000002,
            "halfProminenceWidthHz": 12.344909999999992
          },
          "actual": {
            "frequency": 44.65758,
            "height": 17.720340100366734,
            "prominence": 12.514549743134285,
            "halfProminenceWidthHz": 16.109181692309534
          },
          "frequencyErrorPercent": -1.912373087039354,
          "heightError": -2.2272598996332675
        }
      ],
      "rmse": 8.69763347678907,
      "maxError": 28.242004883967283,
      "issues": [
        "Stuffing parameters are assumed or fitted; independent material validation is pending.",
        "Crossover conditions differ.",
        "Reference extends above the radiation/plane-wave model limits."
      ],
      "status": "incompatible"
    }
  ],
  "modal": {
    "source": "Martin J. King, The Two-Year Transmission Line Speaker Design, 2023-09-23; http://quarter-wave.com/Project13/Satori_TL_Design_Documentation.pdf; Fig 11 traditional centerline method (rounded table values). Compare ANSYS separately; its boundary is also p=0 but geometry is three-dimensional.",
    "boundary": "Rigid cavity, no driver, lossless air, ideal p=0 mouth; axial 1D modes only.",
    "tolerancePercent": 2,
    "rows": [
      {
        "mode": 1,
        "reference": 33,
        "actual": 33.712562648695894,
        "errorPercent": 2.1592807536239267
      },
      {
        "mode": 2,
        "reference": 134,
        "actual": 134.5887822631048,
        "errorPercent": 0.43938974858568347
      },
      {
        "mode": 3,
        "reference": 228,
        "actual": 228.43831229221541,
        "errorPercent": 0.19224223342781954
      },
      {
        "mode": 4,
        "reference": 321,
        "actual": 321.7789476317121,
        "errorPercent": 0.2426628136174669
      },
      {
        "mode": 5,
        "reference": 415,
        "actual": 416.5022495383164,
        "errorPercent": 0.36198784055816446
      },
      {
        "mode": 6,
        "reference": 506,
        "actual": 506.4091962905368,
        "errorPercent": 0.08086883212188312
      },
      {
        "mode": 7,
        "reference": 597,
        "actual": 597.7886916509597,
        "errorPercent": 0.13210915426460357
      },
      {
        "mode": 8,
        "reference": 691,
        "actual": 692.4322428853484,
        "errorPercent": 0.2072710398478117
      }
    ],
    "status": "mismatch"
  },
  "limitations": [
    "Separate source/microphone coordinates, propagation phase and circular-piston directivity. No cabinet shadowing, rectangular-edge diffraction, cone breakup or room reflections; full-speaker response remains provisional.",
    "Circular piston radiation impedance uses full Bessel/Struve integrals. Equivalent-circle mouth and rigid-piston assumptions remain; a1D line still lacks transverse modes.",
    "Equivalent-sphere baffle-step transition is a selectable approximation, not a rectangular-baffle diffraction solution.",
    "Empty-line loss uses King2003 empirical tube resistance10Pa·s/m². It has not been verified as the2023 worksheet law.",
    "Acoustic equivalent profile (digitized), independent of the CAD cavity: Martin J. King, The Two-Year Transmission Line Speaker Design, 2023-09-23; http://quarter-wave.com/Project13/Satori_TL_Design_Documentation.pdf; Fig 8 raster digitization: 0.5in sample, estimated area uncertainty ±0.03×2Sd; not exact MathCad input. The acoustic profile includes corner volumes unlike the CAD cavity.",
    "Stuffing region0–0.75: mjk-2003; calibration=assumed; King 2023 Satori:0.5lb/ft3 over first~3/4 length; King2003 damping correlation is an assumed transfer to this material/design, not a verified2023 fit.",
    "Legacy section attenuation remains empirical Np/m. Material models replace gas propagation inside their regions; density is not converted to JCAL transport parameters."
  ]
}
```
