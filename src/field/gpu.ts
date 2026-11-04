/// <reference types="@webgpu/types" />
import { prepareField } from "./grid";
import { finishField } from "./cpu";
import type { Project } from "../core/types";
import type { FieldSettings, FieldProgress, FieldResult } from "./types";

const shader = /* wgsl */ `
struct Params { grid:vec4<u32>, coeff:vec4<u32>, src:vec4<u32>, record:vec4<u32>, phys:vec4<f32>, signal:vec4<f32>, timing:vec4<u32>, volume:vec4<u32>, particles:vec4<u32>, circuit:vec4<u32>, circuit2:vec4<u32>, medium:vec4<u32>, fitted:vec4<u32> }
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
  if(cfg.medium.y>0u){let a=cfg.medium.x+12u*i;let h=cfg.phys.w;if((geo[i]&2u)!=0u){state[4u*n+i]=aux[a+6u]*state[4u*n+i]-aux[a+7u]/h*(state[i+1u]-p);}else{state[4u*n+i]=0.0;}if((geo[i]&4u)!=0u){state[5u*n+i]=aux[a+8u]*state[5u*n+i]-aux[a+9u]/h*(state[i+nx]-p);}else{state[5u*n+i]=0.0;}if((geo[i]&8u)!=0u){state[6u*n+i]=aux[a+10u]*state[6u*n+i]-aux[a+11u]/h*(state[i+nx*ny]-p);}else{state[6u*n+i]=0.0;}return;}

  if((geo[i]&2u)!=0u){state[4u*n+i]=aux[ax+2u]*state[4u*n+i]-aux[ax+3u]/r*(state[i+1u]-p);}else{state[4u*n+i]=0.0;}
  if((geo[i]&4u)!=0u){state[5u*n+i]=aux[ay+2u]*state[5u*n+i]-aux[ay+3u]/r*(state[i+nx]-p);}else{state[5u*n+i]=0.0;}
  if((geo[i]&8u)!=0u){state[6u*n+i]=aux[az+2u]*state[6u*n+i]-aux[az+3u]/r*(state[i+nx*ny]-p);}else{state[6u*n+i]=0.0;}
}
@compute @workgroup_size(128) fn pressure(@builtin(global_invocation_id) gid:vec3<u32>){
  let i=gid.x;let n=cfg.grid.w;if(i>=n||((geo[i]&1u)==0u)){return;}
  let nx=cfg.grid.x;let ny=cfg.grid.y;let x=i%nx;let y=(i/nx)%ny;let z=i/(nx*ny);let ax=cfg.coeff.x+x*4u;let ay=cfg.coeff.y+y*4u;let az=cfg.coeff.z+z*4u;
  var left=0.0;var below=0.0;var behind=0.0;if(x>0u){left=state[4u*n+i-1u];}if(y>0u){below=state[5u*n+i-nx];}if(z>0u){behind=state[6u*n+i-nx*ny];}
  var iv=1.0;var bx=1.0;var by=1.0;var bz=1.0;var bl=1.0;var bb=1.0;var bh=1.0;
  if(cfg.fitted.y>0u){let a=cfg.fitted.x+4u*i;iv=1.0/aux[a];bx=aux[a+1u];by=aux[a+2u];bz=aux[a+3u];if(x>0u){bl=aux[a-4u+1u];}if(y>0u){bb=aux[a-4u*nx+2u];}if(z>0u){bh=aux[a-4u*nx*ny+3u];}}
  let dx=iv*(bx*state[4u*n+i]-bl*left);let dy=iv*(by*state[5u*n+i]-bb*below);let dz=iv*(bz*state[6u*n+i]-bh*behind);
  let k=cfg.phys.z/cfg.phys.w;state[7u*n+i]=state[i];
  if(cfg.medium.y>0u){let a=cfg.medium.x+12u*i;let h=cfg.phys.w;state[n+i]=aux[a]*state[n+i]-aux[a+1u]/h*dx;state[2u*n+i]=aux[a+2u]*state[2u*n+i]-aux[a+3u]/h*dy;state[3u*n+i]=aux[a+4u]*state[3u*n+i]-aux[a+5u]/h*dz;state[i]=state[n+i]+state[2u*n+i]+state[3u*n+i];return;}

  state[n+i]=aux[ax]*state[n+i]-aux[ax+1u]*k*dx;
  state[2u*n+i]=aux[ay]*state[2u*n+i]-aux[ay+1u]*k*dy;
  state[3u*n+i]=aux[az]*state[3u*n+i]-aux[az+1u]*k*dz;
  state[i]=state[n+i]+state[2u*n+i]+state[3u*n+i];
}
fn circuitDrivers(){
  let nd=cfg.src.x;let ns=cfg.circuit.z;let ni=cfg.circuit.y;let na=cfg.circuit.w;let step=u32(drv[0]);let t=(f32(step)+0.5)*cfg.phys.x;let stateBase=1u+5u*nd;let filterBase=stateBase+ns;
  var input:array<f32,160>;var result:array<f32,160>;
  for(var j=0u;j<ns;j++){input[j]=drv[stateBase+j];}
  for(var i=0u;i<na;i++){let a=cfg.circuit2.x+4u*i;var v=cfg.signal.z*aux[a]*voltage(t,aux[a+1u]);
    for(var j=0u;j<u32(aux[a+2u]);j++){let f=u32(aux[a+3u])+j;let k=cfg.circuit2.y+5u*f;let fs=filterBase+2u*f;let y=aux[k]*v+drv[fs];drv[fs]=aux[k+1u]*v-aux[k+3u]*y+drv[fs+1u];drv[fs+1u]=aux[k+2u]*v-aux[k+4u]*y;v=y;}
    input[ns+i]=v;
  }
  for(var d=0u;d<nd;d++){var avg=0.0;for(var k=0u;k<cfg.src.y;k++){let i=geo[cfg.grid.w+cfg.timing.x+k];avg+=aux[cfg.coeff.w+k*nd+d]*(state[7u*cfg.grid.w+i]+state[i])*0.5;}input[ns+na+d]=avg;}
  for(var r=0u;r<ns+3u*nd;r++){var v=0.0;for(var k=0u;k<ni;k++){v+=aux[cfg.circuit.x+r*ni+k]*input[k];}result[r]=v;}
  for(var j=0u;j<ns;j++){drv[stateBase+j]=result[3u*nd+j];}
  for(var d=0u;d<nd;d++){let a=1u+5u*d;drv[a]=result[3u*nd+2u*d];drv[a+1u]=result[3u*nd+2u*d+1u];drv[a+2u]=2.0*result[nd+d]-drv[a+2u];drv[a+3u]=result[d];drv[a+4u]=result[nd+d];let o=cfg.timing.y+(step*nd+d)*4u;output[o]=drv[a];output[o+1u]=result[d];output[o+2u]=result[nd+d];output[o+3u]=result[2u*nd+d];}
  drv[0]=f32(step+1u);
}
@compute @workgroup_size(1) fn drivers(){
  if(cfg.circuit2.w>0u){circuitDrivers();return;}
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
  let h=cfg.phys.w;var alpha=1.0;if(cfg.fitted.y>0u){alpha=aux[cfg.fitted.x+4u*i];}if(cfg.medium.y>0u){let a=cfg.medium.x+12u*i;let v=q/(3.0*alpha*h*h*h);let dx=aux[a+1u]*v;let dy=aux[a+3u]*v;let dz=aux[a+5u]*v;state[n+i]+=dx;state[2u*n+i]+=dy;state[3u*n+i]+=dz;state[i]+=dx+dy+dz;return;}let delta=cfg.phys.z*cfg.phys.x/(alpha*h*h*h)*q;state[i]+=delta;state[n+i]+=delta/3.0;state[2u*n+i]+=delta/3.0;state[3u*n+i]+=delta/3.0;
}
fn centredFace(i:u32,axis:u32)->f32 {
  if((geo[i]&(2u<<axis))==0u){return 0.0;}
  let nx=cfg.grid.x;let ny=cfg.grid.y;let n=cfg.grid.w;
  var offset=1u;var coordinate=i%nx;var base=cfg.coeff.x;
  if(axis==1u){offset=nx;coordinate=(i/nx)%ny;base=cfg.coeff.y;}
  if(axis==2u){offset=nx*ny;coordinate=i/(nx*ny);base=cfg.coeff.z;}
  let coeff=base+coordinate*4u;let value=state[(4u+axis)*n+i];
  if(cfg.medium.y>0u){let a=cfg.medium.x+12u*i+6u+axis*2u;return 0.5*(value+aux[a]*value-aux[a+1u]/cfg.phys.w*(state[i+offset]-state[i]));}
  return 0.5*(value+aux[coeff+2u]*value-aux[coeff+3u]/(cfg.phys.y*cfg.phys.w)*(state[i+offset]-state[i]));
}
@compute @workgroup_size(128) fn record(@builtin(global_invocation_id) gid:vec3<u32>){
  let k=gid.x;let step=u32(drv[0])-1u;let n=cfg.grid.w;if(k<cfg.record.w){var p=0.0;if(cfg.fitted.w>0u){for(var q=0u;q<8u;q++){p+=state[geo[cfg.timing.w+8u*k+q]]*aux[cfg.fitted.z+8u*k+q];}}else{p=state[geo[cfg.timing.w+k]];}output[cfg.timing.z+step*cfg.record.w+k]=p;}
  let frame=geo[n+step];
  if(k<cfg.volume.w){let i=geo[cfg.particles.x+k];let nx=cfg.grid.x;let ny=cfg.grid.y;let xy=nx*ny;var a=0.0;var b=0.0;var c=0.0;if(i%nx>0u){a=state[4u*n+i-1u];}if((i/nx)%ny>0u){b=state[5u*n+i-nx];}if(i>=xy){c=state[6u*n+i-xy];}let s=8u*n+k*3u;state[s]+=cfg.phys.x*0.5*(state[4u*n+i]+a);state[s+1u]+=cfg.phys.x*0.5*(state[5u*n+i]+b);state[s+2u]+=cfg.phys.x*0.5*(state[6u*n+i]+c);if(frame!=0xffffffffu){let o=cfg.particles.y+(frame*cfg.volume.w+k)*3u;output[o]=state[s];output[o+1u]=state[s+1u];output[o+2u]=state[s+2u];}}
  if(frame==0xffffffffu){return;}
  if(k<cfg.volume.y){output[cfg.volume.z+frame*cfg.volume.y+k]=state[geo[cfg.volume.x+k]];}
  if(k>=cfg.record.y){return;}let i=geo[cfg.record.x+k];let o=(frame*cfg.record.y+k)*4u;
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
      volumeOffset = probeOffset + (g.probeNodes ?? g.probeCells).length,
      particleOffset = volumeOffset + (g.volumeCells?.length ?? 0),
      geo = new Uint32Array(particleOffset + (g.particleCells?.length ?? 0));
    geo.set(g.flags);
    geo.set(g.recordSteps, n);
    geo.set(g.sourceCells, srcOffset);
    geo.set(g.recordCells, recOffset);
    geo.set(g.probeNodes ?? g.probeCells, probeOffset);
    if (g.volumeCells) geo.set(g.volumeCells, volumeOffset);
    if (g.particleCells) geo.set(g.particleCells, particleOffset);
    const weightsOffset = g.aux.length,
      modelsOffset = weightsOffset + g.weights.length,
      cholOffset = modelsOffset + g.models.length,
      circuitOffset = cholOffset + g.chol.length,
      driveOffset = circuitOffset + (g.electrical?.transform.length ?? 0),
      filterOffset = driveOffset + (g.electrical?.drives.length ?? 0),
      mediumOffset = filterOffset + (g.electrical?.filters.length ?? 0),
      fittedOffset = mediumOffset + (g.medium?.length ?? 0),
      probeWeightsOffset = fittedOffset + (g.fitted?.length ?? 0),
      aux = new Float32Array(
        probeWeightsOffset + (g.probeWeights?.length ?? 0),
      );
    aux.set(g.aux);
    aux.set(g.weights, weightsOffset);
    aux.set(g.models, modelsOffset);
    aux.set(g.chol, cholOffset);
    if (g.electrical) {
      aux.set(g.electrical.transform, circuitOffset);
      aux.set(g.electrical.drives, driveOffset);
      aux.set(g.electrical.filters, filterOffset);
    }
    if (g.medium) aux.set(g.medium, mediumOffset);
    if (g.fitted) aux.set(g.fitted, fittedOffset);
    if (g.probeWeights) aux.set(g.probeWeights, probeWeightsOffset);
    if (aux.byteLength > device.limits.maxStorageBufferBindingSize)
      throw Error(
        "Material grid exceeds this GPU buffer limit. Use a coarser grid.",
      );
    const params = new ArrayBuffer(208),
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
        m.settings.signal === "burst" ? 0 : 1,
        m.project.design.voltage * Math.SQRT2,
        0,
      ],
      20,
    );
    uints.set(
      [m.steps, m.layout.driverOffset, m.layout.probeOffset, probeOffset],
      24,
    );
    uints.set(
      [
        volumeOffset,
        g.volumeCells?.length ?? 0,
        m.volume?.offset ?? 0,
        g.particleCells?.length ?? 0,
      ],
      28,
    );
    uints.set([particleOffset, m.particles?.offset ?? 0, 0, 0], 32);
    if (g.electrical) {
      uints.set(
        [
          circuitOffset,
          g.electrical.inputLength,
          g.electrical.stateCount,
          g.electrical.driveCount,
        ],
        36,
      );
      uints.set([driveOffset, filterOffset, g.electrical.filterCount, 1], 40);
    }
    uints.set([mediumOffset, g.medium ? 1 : 0, 0, 0], 44);
    uints.set(
      [
        fittedOffset,
        g.fitted ? 1 : 0,
        probeWeightsOffset,
        g.probeNodes ? 8 : 0,
      ],
      48,
    );
    const uniform = storage(
        208,
        new Uint8Array(params),
        GPUBufferUsage.UNIFORM,
      ),
      state = storage((n * 8 + 3 * (g.particleCells?.length ?? 0)) * 4),
      geometry = storage(geo.byteLength, geo),
      constants = storage(aux.byteLength, aux),
      driver = storage(
        (1 +
          nd * 5 +
          (g.electrical?.stateCount ?? 0) +
          2 * (g.electrical?.filterCount ?? 0)) *
          4,
      ),
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
                  : Math.max(
                      g.probeCells.length,
                      g.particleCells?.length ?? 0,
                      g.recordSteps[i] === 0xffffffff
                        ? 0
                        : Math.max(
                            g.recordCells.length,
                            g.volumeCells?.length ?? 0,
                          ),
                    );
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
