/// <reference types="@webgpu/types" />
import { prepareField } from "./grid";
import { finishField } from "./cpu";
import type { Project } from "../core/types";
import type { FieldSettings, FieldProgress, FieldResult } from "./types";

const shader = /* wgsl */ `
struct Params { grid:vec4<u32>, coeff:vec4<u32>, src:vec4<u32>, record:vec4<u32>, phys:vec4<f32>, signal:vec4<f32>, timing:vec4<u32> }
@group(0) @binding(0) var<uniform> cfg:Params;
@group(0) @binding(1) var<storage,read_write> state:array<f32>;
@group(0) @binding(2) var<storage,read> geo:array<u32>;
@group(0) @binding(3) var<storage,read> aux:array<f32>;
@group(0) @binding(4) var<storage,read_write> drv:array<f32>;
@group(0) @binding(5) var<storage,read_write> output:array<f32>;
fn voltage(t:f32,phase:f32)->f32 {
  let f=cfg.signal.x;
  if(cfg.signal.y>0.5){return cos(6.28318530718*f*t+phase)*(0.5-0.5*cos(3.14159265359*min(1.0,t*f/2.0)));}
  let tau=(t-2.0/f)*f;return exp(-0.5*(tau/0.55)*(tau/0.55))*cos(6.28318530718*tau+phase);
}
@compute @workgroup_size(128) fn velocity(@builtin(global_invocation_id) gid:vec3<u32>){
  let i=gid.x;let n=cfg.grid.w;if(i>=n||((geo[i]&1u)==0u)){return;}
  let nx=cfg.grid.x;let ny=cfg.grid.y;let x=i%nx;let y=(i/nx)%ny;let z=i/(nx*ny);let ax=cfg.coeff.x+x*4u;let ay=cfg.coeff.y+y*4u;let az=cfg.coeff.z+z*4u;
  let r=cfg.phys.y*cfg.phys.w;let p=state[i];
  if((geo[i]&2u)!=0u){state[4u*n+i]=aux[ax+2u]*state[4u*n+i]-aux[ax+3u]/r*(state[i+1u]-p);}else{state[4u*n+i]=0.0;}
  if((geo[i]&4u)!=0u){state[5u*n+i]=aux[ay+2u]*state[5u*n+i]-aux[ay+3u]/r*(state[i+nx]-p);}else{state[5u*n+i]=0.0;}
  if((geo[i]&8u)!=0u){state[6u*n+i]=aux[az+2u]*state[6u*n+i]-aux[az+3u]/r*(state[i+nx*ny]-p);}else{state[6u*n+i]=0.0;}
}
@compute @workgroup_size(128) fn pressure(@builtin(global_invocation_id) gid:vec3<u32>){
  let i=gid.x;let n=cfg.grid.w;if(i>=n||((geo[i]&1u)==0u)){return;}
  let nx=cfg.grid.x;let ny=cfg.grid.y;let x=i%nx;let y=(i/nx)%ny;let z=i/(nx*ny);let ax=cfg.coeff.x+x*4u;let ay=cfg.coeff.y+y*4u;let az=cfg.coeff.z+z*4u;
  var left=0.0;var below=0.0;var behind=0.0;if(x>0u){left=state[4u*n+i-1u];}if(y>0u){below=state[5u*n+i-nx];}if(z>0u){behind=state[6u*n+i-nx*ny];}
  let k=cfg.phys.z/cfg.phys.w;state[7u*n+i]=state[i];
  state[n+i]=aux[ax]*state[n+i]-aux[ax+1u]*k*(state[4u*n+i]-left);
  state[2u*n+i]=aux[ay]*state[2u*n+i]-aux[ay+1u]*k*(state[5u*n+i]-below);
  state[3u*n+i]=aux[az]*state[3u*n+i]-aux[az+1u]*k*(state[6u*n+i]-behind);
  state[i]=state[n+i]+state[2u*n+i]+state[3u*n+i];
}
@compute @workgroup_size(1) fn drivers(){
  let n=cfg.grid.w;let nd=cfg.src.x;let nc=cfg.src.y;let step=u32(drv[0]);let dt=cfg.phys.x;let t=(f32(step)+0.5)*dt;
  var rhs:array<f32,8>;var vm:array<f32,8>;var volts:array<f32,8>;
  for(var d=0u;d<nd;d++){var avg=0.0;for(var k=0u;k<nc;k++){let i=geo[n+cfg.timing.x+k];avg+=aux[cfg.coeff.w+k*nd+d]*(state[7u*n+i]+state[i])*0.5;}
    let a=cfg.src.z+d*9u;let s=1u+d*5u;let mass=aux[a];let cms=aux[a+2u];let bl=aux[a+3u];let re=aux[a+4u];let le=aux[a+5u];let sd=aux[a+6u];
    volts[d]=cfg.signal.z*aux[a+7u]*voltage(t,aux[a+8u]);rhs[d]=2.0*mass/dt*drv[s+1u]-drv[s]/cms+bl*(volts[d]+2.0*le/dt*drv[s+2u])/(re+2.0*le/dt)-sd*avg;
  }
  for(var i=0u;i<nd;i++){var v=rhs[i];for(var j=0u;j<i;j++){v-=aux[cfg.src.w+i*nd+j]*vm[j];}vm[i]=v/aux[cfg.src.w+i*nd+i];}
  for(var ii=0u;ii<nd;ii++){let i=nd-1u-ii;var v=vm[i];for(var j=i+1u;j<nd;j++){v-=aux[cfg.src.w+j*nd+i]*vm[j];}vm[i]=v/aux[cfg.src.w+i*nd+i];}
  for(var d=0u;d<nd;d++){let a=cfg.src.z+d*9u;let s=1u+d*5u;let bl=aux[a+3u];let re=aux[a+4u];let le=aux[a+5u];let im=(volts[d]+2.0*le/dt*drv[s+2u]-bl*vm[d])/(re+2.0*le/dt);
    drv[s]+=dt*vm[d];drv[s+1u]=2.0*vm[d]-drv[s+1u];if(le>0.0){drv[s+2u]=2.0*im-drv[s+2u];}else{drv[s+2u]=(volts[d]-bl*drv[s+1u])/re;}drv[s+3u]=vm[d];drv[s+4u]=im;
    let o=cfg.timing.y+(step*nd+d)*4u;output[o]=drv[s];output[o+1u]=vm[d];output[o+2u]=im;output[o+3u]=volts[d];
  }drv[0]=f32(step+1u);
}
@compute @workgroup_size(128) fn injection(@builtin(global_invocation_id) gid:vec3<u32>){
  let k=gid.x;let nd=cfg.src.x;if(k>=cfg.src.y){return;}let n=cfg.grid.w;let i=geo[n+cfg.timing.x+k];var q=0.0;
  for(var d=0u;d<nd;d++){q+=aux[cfg.coeff.w+k*nd+d]*aux[cfg.src.z+d*9u+6u]*drv[1u+d*5u+3u];}
  let h=cfg.phys.w;let delta=cfg.phys.z*cfg.phys.x/(h*h*h)*q;state[i]+=delta;state[n+i]+=delta/3.0;state[2u*n+i]+=delta/3.0;state[3u*n+i]+=delta/3.0;
}
fn centredFace(i:u32,axis:u32)->f32 {
  if((geo[i]&(2u<<axis))==0u){return 0.0;}
  let nx=cfg.grid.x;let ny=cfg.grid.y;let n=cfg.grid.w;
  var offset=1u;var coordinate=i%nx;var base=cfg.coeff.x;
  if(axis==1u){offset=nx;coordinate=(i/nx)%ny;base=cfg.coeff.y;}
  if(axis==2u){offset=nx*ny;coordinate=i/(nx*ny);base=cfg.coeff.z;}
  let coeff=base+coordinate*4u;let value=state[(4u+axis)*n+i];
  return 0.5*(value+aux[coeff+2u]*value-aux[coeff+3u]/(cfg.phys.y*cfg.phys.w)*(state[i+offset]-state[i]));
}
@compute @workgroup_size(128) fn record(@builtin(global_invocation_id) gid:vec3<u32>){
  let k=gid.x;let step=u32(drv[0])-1u;let n=cfg.grid.w;if(k<cfg.record.w){output[cfg.timing.z+step*cfg.record.w+k]=state[geo[cfg.timing.w+k]];}
  let frame=geo[n+step];if(frame==0xffffffffu||k>=cfg.record.y){return;}let i=geo[cfg.record.x+k];let o=(frame*cfg.record.y+k)*4u;
  let nx=cfg.grid.x;let ny=cfg.grid.y;let x=i%nx;let y=(i/nx)%ny;let z=i/(nx*ny);
  var a=0.0;var b=0.0;var c=0.0;if(x>0u){a=centredFace(i-1u,0u);}if(y>0u){b=centredFace(i-nx,1u);}if(z>0u){c=centredFace(i-nx*ny,2u);}
  output[o]=state[i];output[o+1u]=0.5*(centredFace(i,0u)+a);output[o+2u]=0.5*(centredFace(i,1u)+b);output[o+3u]=0.5*(centredFace(i,2u)+c);
}
`;

export async function runFieldGpu(
  project: Project,
  settings: Partial<FieldSettings>,
  progress: FieldProgress = () => {},
): Promise<FieldResult> {
  if (!navigator.gpu) throw Error("WebGPU is unavailable.");
  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: "high-performance",
  });
  if (!adapter) throw Error("No WebGPU adapter is available.");
  const start = performance.now(),
    g = prepareField(project, settings, progress),
    m = g.meta,
    n = m.cells,
    nd = m.sources.length;
  const device = await adapter.requestDevice(),
    buffers: GPUBuffer[] = [];
  let failure = "";
  device.addEventListener("uncapturederror", (event) => {
    failure = event.error.message;
  });
  void device.lost.then((info) => {
    failure = info.message || "GPU device lost";
  });
  try {
    const storage = (
      bytes: number,
      data?: ArrayBufferView,
      usage = GPUBufferUsage.STORAGE,
    ) => {
      const b = device.createBuffer({
        size: Math.max(4, Math.ceil(bytes / 4) * 4),
        usage,
        mappedAtCreation: Boolean(data),
      });
      buffers.push(b);
      if (data) {
        new Uint8Array(b.getMappedRange()).set(
          new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
        );
        b.unmap();
      }
      return b;
    };
    const srcOffset = n + m.steps,
      recOffset = srcOffset + g.sourceCells.length,
      probeOffset = recOffset + g.recordCells.length,
      geo = new Uint32Array(probeOffset + g.probeCells.length);
    geo.set(g.flags);
    geo.set(g.recordSteps, n);
    geo.set(g.sourceCells, srcOffset);
    geo.set(g.recordCells, recOffset);
    geo.set(g.probeCells, probeOffset);
    const weightsOffset = g.aux.length,
      modelsOffset = weightsOffset + g.weights.length,
      cholOffset = modelsOffset + g.models.length,
      aux = new Float32Array(cholOffset + g.chol.length);
    aux.set(g.aux);
    aux.set(g.weights, weightsOffset);
    aux.set(g.models, modelsOffset);
    aux.set(g.chol, cholOffset);
    const params = new ArrayBuffer(112),
      uints = new Uint32Array(params),
      floats = new Float32Array(params);
    uints.set([...m.dimensions, n], 0);
    uints.set([...g.coeffOffsets, weightsOffset], 4);
    uints.set([nd, g.sourceCells.length, modelsOffset, cholOffset], 8);
    uints.set(
      [recOffset, g.recordCells.length, m.times.length, g.probeCells.length],
      12,
    );
    floats.set([m.dt, m.rho, m.bulk, m.h], 16);
    floats.set(
      [
        m.settings.frequency,
        m.settings.signal === "tone" ? 1 : 0,
        m.project.design.voltage * Math.SQRT2,
        0,
      ],
      20,
    );
    uints.set(
      [m.steps, m.layout.driverOffset, m.layout.probeOffset, probeOffset],
      24,
    );
    const uniform = storage(
        112,
        new Uint8Array(params),
        GPUBufferUsage.UNIFORM,
      ),
      state = storage(n * 8 * 4),
      geometry = storage(geo.byteLength, geo),
      constants = storage(aux.byteLength, aux),
      driver = storage((1 + nd * 5) * 4),
      output = storage(
        m.layout.total * 4,
        undefined,
        GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      ),
      readback = storage(
        m.layout.total * 4,
        undefined,
        GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      );
    const module = device.createShaderModule({ code: shader });
    const info = await module.getCompilationInfo();
    const errors = info.messages.filter((v) => v.type === "error");
    if (errors.length) throw Error(errors.map((v) => v.message).join("; "));
    const layout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
        ...Array.from({ length: 5 }, (_, i) => ({
          binding: i + 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: (i === 1 || i === 2
              ? "read-only-storage"
              : "storage") as GPUBufferBindingType,
          },
        })),
      ],
    });
    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [layout],
      }),
      pipelines = await Promise.all(
        ["velocity", "pressure", "drivers", "injection", "record"].map(
          (entryPoint) =>
            device.createComputePipelineAsync({
              layout: pipelineLayout,
              compute: { module, entryPoint },
            }),
        ),
      );
    const bind = device.createBindGroup({
      layout,
      entries: [uniform, state, geometry, constants, driver, output].map(
        (buffer, binding) => ({ binding, resource: { buffer } }),
      ),
    });
    for (let first = 0; first < m.steps; first += 24) {
      const last = Math.min(m.steps, first + 24),
        encoder = device.createCommandEncoder(),
        pass = encoder.beginComputePass();
      pass.setBindGroup(0, bind);
      for (let i = first; i < last; i++) {
        for (let kernel = 0; kernel < 5; kernel++) {
          pass.setPipeline(pipelines[kernel]);
          const count =
            kernel < 2
              ? n
              : kernel === 2
                ? 1
                : kernel === 3
                  ? g.sourceCells.length
                  : g.recordSteps[i] === 0xffffffff
                    ? g.probeCells.length
                    : g.recordCells.length;
          pass.dispatchWorkgroups(kernel === 2 ? 1 : Math.ceil(count / 128));
        }
      }
      pass.end();
      device.queue.submit([encoder.finish()]);
      await device.queue.onSubmittedWorkDone();
      if (failure) throw Error(failure);
      progress(0.2 + (0.79 * last) / m.steps);
    }
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(output, 0, readback, 0, m.layout.total * 4);
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPUMapMode.READ);
    const data = new Float32Array(readback.getMappedRange().slice(0));
    readback.unmap();
    if (failure) throw Error(failure);
    return finishField(
      g,
      data,
      "webgpu-float32",
      (performance.now() - start) / 1000,
    );
  } finally {
    buffers.forEach((b) => b.destroy());
    device.destroy();
  }
}
