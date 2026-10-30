import * as THREE from "three";
import type { FieldResult } from "../field/types";
import type { FieldMetric } from "../field/pixels";
import { fieldScale } from "../field/pixels";
import { frameBlend, particleMotionAt } from "../field/playback";
import { visualMotionClipper } from "../field/grid";
export interface FieldDisplay {
  result: FieldResult;
  frame: number;
  metric: FieldMetric;
  range: number;
  displayMode: "slice" | "volume" | "fronts";
  contours: boolean;
  particles: boolean;
  particleScale: number;
  interpolation: boolean;
  opacity: number;
  pressureCurve: "linear" | "soft";
  frontShading: boolean;
}
const vertex = `out vec2 vUv; out vec3 vWorld;
void main(){vUv=uv;vWorld=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const colours = `vec3 pressureColour(float p){return p<0.0?vec3(.549,.737,.796):vec3(.745,.773,.788);}`;
const planeFragment = `precision highp float;
uniform sampler2D uA;uniform sampler2D uB;uniform sampler2D uMask;
uniform float uMix;uniform float uScale;uniform float uRhoC;uniform int uMetric;uniform bool uContours;uniform float uOpacity;uniform bool uSoft;
in vec2 vUv;out vec4 outColour;
${colours}
void main(){if(texture(uMask,vUv).r<.5)discard;vec4 s=mix(texture(uA,vUv),texture(uB,vUv),uMix);
float speed=length(s.yzw);float value=uMetric==0?s.x:uMetric==1?speed:abs(s.x)*speed;
float q=clamp(abs(value)/uScale,0.0,1.0);vec3 col=mix(vec3(.045,.065,.08),pressureColour(value),q);
float alpha=clamp((.025+.8*(uSoft?sqrt(q):q))*uOpacity,0.0,1.0);
if(uContours&&uMetric==0){float level=s.x/uScale*4.0;float distance=abs(level-round(level));
float line=1.0-smoothstep(max(fwidth(level)*.7,.006),max(fwidth(level)*1.5,.012),distance);
line*=smoothstep(.0001,.002,fwidth(level));float activity=smoothstep(.015,.10,(abs(s.x)+uRhoC*speed)/uScale);col=mix(col,vec3(.86,.94,.98),line*activity*.65);alpha=max(alpha,clamp(line*activity*.6*uOpacity,0.0,1.0));}
outColour=vec4(col,alpha);}`;
const volumeFragment = `precision highp float;precision highp sampler3D;
uniform sampler3D uA;uniform sampler3D uB;uniform sampler3D uMask;uniform sampler2D uDepth;
uniform vec3 uMin;uniform vec3 uMax;uniform vec3 uCamera;uniform vec2 uViewport;
uniform mat4 uProjectionInverse;uniform mat4 uCameraWorld;
uniform float uMix;uniform float uScale;uniform float uPitch;uniform int uSteps;uniform bool uFronts;uniform float uOpacity;uniform bool uSoft;uniform bool uShade;uniform vec3 uTexel;
in vec3 vWorld;out vec4 outColour;
${colours}
float samplePressure(vec3 uv){return mix(texture(uA,uv).r,texture(uB,uv).r,uMix);}
float neighbour(vec3 uv,float center){return texture(uMask,uv).r<.5?center:samplePressure(uv);}
vec3 pressureGradient(vec3 uv,float p){return vec3(neighbour(uv+vec3(uTexel.x,0,0),p)-neighbour(uv-vec3(uTexel.x,0,0),p),neighbour(uv+vec3(0,uTexel.y,0),p)-neighbour(uv-vec3(0,uTexel.y,0),p),neighbour(uv+vec3(0,0,uTexel.z),p)-neighbour(uv-vec3(0,0,uTexel.z),p));}
void main(){vec3 rd=normalize(vWorld-uCamera);vec3 safe=sign(rd)*max(abs(rd),vec3(1e-7));safe+=vec3(equal(safe,vec3(0.0)))*1e-7;
vec3 a=(uMin-uCamera)/safe,b=(uMax-uCamera)/safe;vec3 lo=min(a,b),hi=max(a,b);
float begin=max(max(lo.x,lo.y),max(lo.z,0.0));float end=min(min(hi.x,hi.y),hi.z);
vec2 screen=gl_FragCoord.xy/uViewport;float depth=texture(uDepth,screen).x;
if(depth<.999999){vec4 v=uProjectionInverse*vec4(screen*2.0-1.0,depth*2.0-1.0,1.0);v/=v.w;vec3 world=(uCameraWorld*v).xyz;end=min(end,dot(world-uCamera,rd)-.3);}
if(end<=begin)discard;float ds=(end-begin)/float(uSteps);vec4 accum=vec4(0.0);
float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
float previous=0.0;bool previousAir=false;
for(int i=0;i<160;i++){if(i>=uSteps||accum.a>.97)break;float t=begin+(float(i)+.25+.5*jitter)*ds;
vec3 uv=(uCamera+t*rd-uMin)/(uMax-uMin);if(texture(uMask,uv).r<.5){previousAir=false;continue;}
float p=samplePressure(uv);float q=abs(p)/uScale;
float density=smoothstep(.025,.8,uSoft?sqrt(q):q)*.12;
if(uFronts){float level=.35;bool crossing=previousAir&&((p/uScale-level)*(previous-level)<0.0||(p/uScale+level)*(previous+level)<0.0);density=crossing?.75:exp(-pow((q-level)/.055,2.0))*.10;}
float alpha=1.0-exp(-density*uOpacity*ds/uPitch);if(uFronts&&density>.5)alpha=1.0-pow(.35,uOpacity);
vec3 colour=pressureColour(p);if(uShade&&uFronts&&alpha>.01){vec3 grad=pressureGradient(uv,p);float len=length(grad);if(len>uScale*1e-8)colour*=.58+.42*abs(dot(grad/len,normalize(vec3(.4,.8,-.4))));}accum.rgb+=(1.0-accum.a)*alpha*colour;accum.a+=(1.0-accum.a)*alpha;
previous=p/uScale;previousAir=true;}
if(accum.a<.002)discard;outColour=vec4(accum.rgb/max(accum.a,1e-6),accum.a);}`;

function texture(
  data: Float32Array,
  width: number,
  height: number,
  components: 1 | 4,
  linear: boolean,
) {
  const t = new THREE.DataTexture(
    data,
    width,
    height,
    components === 4 ? THREE.RGBAFormat : THREE.RedFormat,
    THREE.FloatType,
  );
  t.minFilter = t.magFilter = linear ? THREE.LinearFilter : THREE.NearestFilter;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}
function texture3(
  data: Float32Array | Uint8Array,
  dims: number[],
  linear: boolean,
) {
  const t = new THREE.Data3DTexture(data, dims[0], dims[1], dims[2]);
  t.format = THREE.RedFormat;
  t.type =
    data instanceof Float32Array ? THREE.FloatType : THREE.UnsignedByteType;
  t.minFilter = t.magFilter = linear ? THREE.LinearFilter : THREE.NearestFilter;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}
export class FieldRenderer {
  readonly group = new THREE.Group();
  readonly plane: THREE.Mesh;
  readonly cube?: THREE.Mesh;
  private planeA: THREE.DataTexture;
  private planeB: THREE.DataTexture;
  private planeMask: THREE.DataTexture;
  private volumeA?: THREE.Data3DTexture;
  private volumeB?: THREE.Data3DTexture;
  private volumeMask?: THREE.Data3DTexture;
  private depthTarget = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: true,
  });
  private size = new THREE.Vector2();
  private previousA = -1;
  private previousB = -1;
  private particleData: Float32Array;
  private particlePositions: Float32Array;
  private links: Float32Array;
  private points: THREE.Points;
  private lines: THREE.LineSegments;
  private clip: ReturnType<typeof visualMotionClipper>;
  private start: [number, number, number] = [0, 0, 0];
  private end: [number, number, number] = [0, 0, 0];
  constructor(
    readonly result: FieldResult,
    linear: boolean,
  ) {
    const { plane, volume, particles } = result.meta,
      n = plane.width * plane.height;
    this.planeA = texture(
      new Float32Array(n * 4),
      plane.width,
      plane.height,
      4,
      linear,
    );
    this.planeB = texture(
      new Float32Array(n * 4),
      plane.width,
      plane.height,
      4,
      linear,
    );
    this.planeMask = new THREE.DataTexture(
      Uint8Array.from(result.mask, (x) => x * 255),
      plane.width,
      plane.height,
      THREE.RedFormat,
    );
    this.planeMask.unpackAlignment = 1;
    this.planeMask.needsUpdate = true;
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: vertex,
      fragmentShader: planeFragment,
      uniforms: {
        uA: { value: this.planeA },
        uB: { value: this.planeB },
        uMask: { value: this.planeMask },
        uMix: { value: 0 },
        uScale: { value: 1 },
        uRhoC: { value: result.meta.rho * result.meta.c },
        uMetric: { value: 0 },
        uContours: { value: true },
        uOpacity: { value: 1 },
        uSoft: { value: true },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.plane = new THREE.Mesh(
      new THREE.PlaneGeometry(
        plane.width * plane.pitchMm,
        plane.height * plane.pitchMm,
      ),
      mat,
    );
    const u = new THREE.Vector3(...plane.u),
      v = new THREE.Vector3(...plane.v);
    this.plane.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(u, v, u.clone().cross(v)),
    );
    this.plane.position
      .set(...plane.originMm)
      .addScaledVector(u, ((plane.width - 1) * plane.pitchMm) / 2)
      .addScaledVector(v, ((plane.height - 1) * plane.pitchMm) / 2);
    this.group.add(this.plane);
    this.depthTarget.depthTexture = new THREE.DepthTexture(
      1,
      1,
      THREE.UnsignedIntType,
    );
    if (volume && result.volumeMask) {
      this.volumeA = texture3(
        new Float32Array(volume.cells),
        volume.dimensions,
        linear,
      );
      this.volumeB = texture3(
        new Float32Array(volume.cells),
        volume.dimensions,
        linear,
      );
      this.volumeMask = texture3(
        Uint8Array.from(result.volumeMask, (x) => x * 255),
        volume.dimensions,
        false,
      );
      const extent = volume.dimensions.map((d) => d * volume.pitchMm),
        min = volume.originMm.map((v) => v - volume.pitchMm / 2),
        max = min.map((v, i) => v + extent[i]);
      const material = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: vertex,
        fragmentShader: volumeFragment,
        uniforms: {
          uA: { value: this.volumeA },
          uB: { value: this.volumeB },
          uMask: { value: this.volumeMask },
          uDepth: { value: this.depthTarget.depthTexture },
          uMin: { value: new THREE.Vector3(...min) },
          uMax: { value: new THREE.Vector3(...max) },
          uCamera: { value: new THREE.Vector3() },
          uViewport: { value: new THREE.Vector2(1, 1) },
          uProjectionInverse: { value: new THREE.Matrix4() },
          uCameraWorld: { value: new THREE.Matrix4() },
          uMix: { value: 0 },
          uScale: { value: 1 },
          uPitch: { value: volume.pitchMm },
          uSteps: { value: 96 },
          uFronts: { value: false },
          uOpacity: { value: 1 },
          uSoft: { value: true },
          uShade: { value: true },
          uTexel: {
            value: new THREE.Vector3(
              ...(volume.dimensions.map((n) => 1 / n) as [
                number,
                number,
                number,
              ]),
            ),
          },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.BackSide,
        toneMapped: false,
      });
      this.cube = new THREE.Mesh(
        new THREE.BoxGeometry(...(extent as [number, number, number])),
        material,
      );
      this.cube.position
        .set(min[0], min[1], min[2])
        .addScaledVector(new THREE.Vector3(...extent), 0.5);
      this.cube.renderOrder = 3;
      this.group.add(this.cube);
    }
    const count = particles?.count ?? 0;
    this.particleData = new Float32Array(count * 3);
    this.particlePositions = new Float32Array(count * 3);
    this.links = new Float32Array(count * 6);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute(
      "position",
      new THREE.BufferAttribute(this.particlePositions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.points = new THREE.Points(
      pg,
      new THREE.PointsMaterial({
        color: "#c4f2f8",
        size: 3,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    this.points.renderOrder = 4;
    this.points.frustumCulled = false;
    const lg = new THREE.BufferGeometry();
    lg.setAttribute(
      "position",
      new THREE.BufferAttribute(this.links, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.lines = new THREE.LineSegments(
      lg,
      new THREE.LineBasicMaterial({
        color: "#a3d6df",
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    );
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 4;
    this.group.add(this.points, this.lines);
    this.clip = visualMotionClipper(result.meta.project);
  }
  update(display: FieldDisplay) {
    const { a, b, mix } = frameBlend(
        this.result,
        display.frame,
        display.interpolation,
      ),
      meta = this.result.meta,
      n = this.result.mask.length;
    if (a !== this.previousA) {
      (this.planeA.image.data as Float32Array).set(
        this.result.data.subarray(a * n * 4, (a + 1) * n * 4),
      );
      this.planeA.needsUpdate = true;
      if (meta.volume && this.volumeA) {
        (this.volumeA.image.data as Float32Array).set(
          this.result.data.subarray(
            meta.volume.offset + a * meta.volume.cells,
            meta.volume.offset + (a + 1) * meta.volume.cells,
          ),
        );
        this.volumeA.needsUpdate = true;
      }
    }
    if (b !== this.previousB) {
      (this.planeB.image.data as Float32Array).set(
        this.result.data.subarray(b * n * 4, (b + 1) * n * 4),
      );
      this.planeB.needsUpdate = true;
      if (meta.volume && this.volumeB) {
        (this.volumeB.image.data as Float32Array).set(
          this.result.data.subarray(
            meta.volume.offset + b * meta.volume.cells,
            meta.volume.offset + (b + 1) * meta.volume.cells,
          ),
        );
        this.volumeB.needsUpdate = true;
      }
    }
    this.previousA = a;
    this.previousB = b;
    const planeMat = this.plane.material as THREE.ShaderMaterial;
    planeMat.uniforms.uMix.value = mix;
    planeMat.uniforms.uScale.value = fieldScale(
      this.result,
      display.metric,
      display.range,
    );
    planeMat.uniforms.uMetric.value = [
      "pressure",
      "velocity",
      "intensity",
    ].indexOf(display.metric);
    planeMat.uniforms.uContours.value = display.contours;
    planeMat.uniforms.uOpacity.value = display.opacity;
    planeMat.uniforms.uSoft.value = display.pressureCurve === "soft";
    const volumeVisible = Boolean(
      this.cube &&
      display.displayMode !== "slice" &&
      display.metric === "pressure",
    );
    this.plane.visible = !volumeVisible;
    if (this.cube) {
      this.cube.visible = volumeVisible;
      const mat = this.cube.material as THREE.ShaderMaterial;
      mat.uniforms.uMix.value = mix;
      mat.uniforms.uScale.value = fieldScale(
        this.result,
        "pressure",
        display.range,
      );
      mat.uniforms.uFronts.value = display.displayMode === "fronts";
      mat.uniforms.uOpacity.value = display.opacity;
      mat.uniforms.uSoft.value = display.pressureCurve === "soft";
      mat.uniforms.uShade.value = display.frontShading;
    }
    this.points.visible = this.lines.visible =
      display.particles && Boolean(meta.particles);
    if (this.points.visible && meta.particles) {
      particleMotionAt(
        this.result,
        display.frame,
        this.particleData,
        display.interpolation,
      );
      for (let k = 0; k < meta.particles.count; k++) {
        for (let j = 0; j < 3; j++) {
          this.start[j] = meta.particles.positionsMm[k][j];
          this.end[j] =
            this.start[j] +
            this.particleData[k * 3 + j] * 1000 * display.particleScale;
        }
        const fraction = this.clip(this.start, this.end);
        for (let j = 0; j < 3; j++) {
          const v = this.start[j] + (this.end[j] - this.start[j]) * fraction;
          this.particlePositions[k * 3 + j] = v;
          this.links[k * 6 + j] = this.start[j];
          this.links[k * 6 + 3 + j] = v;
        }
      }
      this.points.geometry.attributes.position.needsUpdate = true;
      this.lines.geometry.attributes.position.needsUpdate = true;
    }
  }
  preRender(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    steps: number,
  ) {
    if (!this.cube?.visible) return;
    camera.updateMatrixWorld(true);
    renderer.getDrawingBufferSize(this.size);
    if (
      this.depthTarget.width !== this.size.x ||
      this.depthTarget.height !== this.size.y
    )
      this.depthTarget.setSize(this.size.x, this.size.y);
    const u = (this.cube.material as THREE.ShaderMaterial).uniforms;
    u.uSteps.value = steps;
    u.uViewport.value.copy(this.size);
    u.uCamera.value.setFromMatrixPosition(camera.matrixWorld);
    u.uProjectionInverse.value.copy(camera.projectionMatrixInverse);
    u.uCameraWorld.value.copy(camera.matrixWorld);
    const target = renderer.getRenderTarget();
    this.group.visible = false;
    renderer.setRenderTarget(this.depthTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(target);
    this.group.visible = true;
  }
  dispose() {
    this.planeA.dispose();
    this.planeB.dispose();
    this.planeMask.dispose();
    this.volumeA?.dispose();
    this.volumeB?.dispose();
    this.volumeMask?.dispose();
    this.depthTarget.dispose();
  }
}

/** Async GPU queries, no blocking reads. Adaptive controls affect drawing only. */
export class RenderBudget {
  private gl: WebGL2RenderingContext;
  private ext: any;
  private pending: WebGLQuery[] = [];
  private active: WebGLQuery | null = null;
  private started = 0;
  private last = 0;
  private elapsed = 0;
  private frameMs = 16.7;
  private workMs = 0;
  private gpuMs: number | null = null;
  private level = 1;
  private lastChange = 0;
  readonly maxRatio = Math.min(devicePixelRatio, 2);
  steps = 96;
  constructor(private renderer: THREE.WebGLRenderer) {
    this.gl = renderer.getContext() as WebGL2RenderingContext;
    this.ext = this.gl.getExtension("EXT_disjoint_timer_query_webgl2");
  }
  begin(now: number) {
    this.started = performance.now();
    if (this.last && now - this.last < 100)
      this.frameMs = 0.94 * this.frameMs + 0.06 * (now - this.last);
    this.last = now;
    if (this.ext && this.pending.length < 4) {
      this.active = this.gl.createQuery();
      this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, this.active!);
    }
  }
  end(quality: "auto" | "high" | "low", now: number) {
    this.workMs = 0.9 * this.workMs + 0.1 * (performance.now() - this.started);
    if (this.active) {
      this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
      this.pending.push(this.active);
      this.active = null;
    }
    while (
      this.pending.length &&
      this.gl.getQueryParameter(this.pending[0], this.gl.QUERY_RESULT_AVAILABLE)
    ) {
      const q = this.pending.shift()!;
      if (!this.gl.getParameter(this.ext.GPU_DISJOINT_EXT)) {
        const ms = this.gl.getQueryParameter(q, this.gl.QUERY_RESULT) / 1e6;
        this.gpuMs = this.gpuMs === null ? ms : 0.85 * this.gpuMs + 0.15 * ms;
      }
      this.gl.deleteQuery(q);
    }
    if (quality === "auto" && now - this.lastChange > 1000) {
      const cost = this.gpuMs ?? this.workMs;
      if (cost > 14 || this.frameMs > 25) {
        this.level = Math.max(0.5, this.level - 0.15);
        this.lastChange = now;
      } else if (
        cost < 9 &&
        this.frameMs < 18 &&
        now - this.lastChange > 3000
      ) {
        this.level = Math.min(1, this.level + 0.05);
        this.lastChange = now;
      }
    }
    const level = quality === "high" ? 1 : quality === "low" ? 0.6 : this.level,
      ratio = Math.max(0.65, this.maxRatio * level);
    this.steps =
      quality === "high"
        ? 128
        : quality === "low"
          ? 48
          : Math.round(32 + 64 * level);
    if (Math.abs(this.renderer.getPixelRatio() - ratio) > 0.02)
      this.renderer.setPixelRatio(ratio);
    if (now - this.elapsed < 750) return null;
    this.elapsed = now;
    return {
      fps: 1000 / this.frameMs,
      gpuMs: this.gpuMs,
      cpuSubmitMs: this.workMs,
      ratio,
      steps: this.steps,
    };
  }
  dispose() {
    for (const q of this.pending) this.gl.deleteQuery(q);
  }
}
