import { encodeField, decodeField } from "../field/archive";
import type { FieldResult, FieldSettings } from "../field/types";
import fs from "node:fs/promises";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import {
  commands,
  defaultView,
  parseProject,
  parseDriver,
  type Command,
  type WorkspaceState,
  viewSchema,
} from "./contracts";
import { defaultProject, drivers } from "../core/defaults";
import { buildGeometry, editableLayout } from "../core/geometry";
import { traceRoute } from "../core/layout";
import { validateProject } from "../core/validation";
import {
  makeBundle,
  responseCsv,
  cutList,
  openScad,
  cadQueryScript,
  safeName,
} from "../core/exports";
import type { Project, Simulation } from "../core/types";
import { sourceHeadroom } from "../core/metrics";
export { buildGeometry };

export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export interface Artifact {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  size: number;
  projectRevision: number;
  createdAt: string;
}
export interface AnalysisJob {
  id: string;
  kind: string;
  status: "running" | "completed" | "failed" | "cancelled" | "interrupted";
  progress: number;
  valid?: number;
  projectRevision: number;
  createdAt: string;
  finishedAt?: string;
  error?: string;
  result?: any;
}
export interface ServiceOptions {
  directory: string;
  workerPath: string;
  capture?: (region: string, revision: number) => Promise<Uint8Array>;
  exportStep?: (manifest: unknown, destination: string) => Promise<void>;
  cadStatus?: () => Promise<boolean>;
  runField?: (
    id: string,
    project: Project,
    settings: Partial<FieldSettings>,
    progress: (value: number) => void,
    signal: AbortSignal,
  ) => Promise<FieldResult>;
  fieldCapabilities?: () => unknown;
}
export class DesignService extends EventEmitter {
  state: WorkspaceState = {
    version: 1,
    revision: 0,
    projectRevision: 0,
    project: structuredClone(defaultProject),
    library: [],
    snapshots: [],
    view: structuredClone(defaultView),
    updatedAt: new Date().toISOString(),
    initialized: false,
  };
  readonly jobs = new Map<string, AnalysisJob>();
  readonly artifacts = new Map<string, Artifact>();
  private workers = new Map<string, { terminate: () => Promise<unknown> }>();
  private undoStack: WorkspaceState[] = [];
  private redoStack: WorkspaceState[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private fieldCache = new Map<string, FieldResult>();
  private writes = new Map<string, Promise<void>>();
  private computations = new Set<Worker>();
  readonly files: string;
  constructor(readonly options: ServiceOptions) {
    super();
    this.files = path.join(options.directory, "files");
  }
  async initialize() {
    await fs.mkdir(this.files, { recursive: true });
    try {
      const data = JSON.parse(
        await fs.readFile(
          path.join(this.options.directory, "workspace.json"),
          "utf8",
        ),
      );
      parseProject(data.project);
      data.view = viewSchema.parse(data.view);
      this.state = data;
    } catch (error: any) {
      if (error.code !== "ENOENT")
        throw new DomainError(
          "PERSISTENCE_INVALID",
          "Workspace file is invalid; it was preserved for recovery.",
          String(error.message),
        );
    }
    for (const [filename, target] of [
      ["artifacts.json", this.artifacts],
      ["jobs.json", this.jobs],
    ] as const) {
      try {
        const rows = JSON.parse(
          await fs.readFile(
            path.join(this.options.directory, filename),
            "utf8",
          ),
        );
        for (const row of rows) {
          if (filename === "jobs.json" && row.status === "running") {
            row.status = "interrupted";
            row.error = "Application stopped before this worker completed.";
          }
          target.set(row.id, row);
        }
      } catch (error: any) {
        if (error.code !== "ENOENT")
          this.emit("diagnostic", `${filename}: ${error.message}`);
      }
    }
    try {
      const history = JSON.parse(
        await fs.readFile(
          path.join(this.options.directory, "history.json"),
          "utf8",
        ),
      );
      for (const key of ["undo", "redo"]) {
        if (!Array.isArray(history[key])) throw Error("Invalid history.");
        history[key].forEach((state: any) => parseProject(state.project));
      }
      this.undoStack = history.undo.slice(-50);
      this.redoStack = history.redo.slice(-50);
    } catch (error: any) {
      if (error.code !== "ENOENT")
        this.emit("diagnostic", "History unavailable: " + error.message);
    }
    return this;
  }
  private async persist(name: string, value: unknown) {
    const data = JSON.stringify(value, null, 2),
      previous = this.writes.get(name) ?? Promise.resolve();
    const operation = previous
      .catch(() => {})
      .then(async () => {
        const dest = path.join(this.options.directory, name),
          tmp = dest + "." + randomUUID() + ".tmp";
        await fs.writeFile(tmp, data, "utf8");
        for (let i = 0; ; i++) {
          try {
            await fs.rename(tmp, dest);
            break;
          } catch (error: any) {
            if (i >= 8 || !["EPERM", "EACCES", "EBUSY"].includes(error.code))
              throw error;
            await new Promise((r) => setTimeout(r, 10 * (i + 1)));
          }
        }
      });
    this.writes.set(name, operation);
    await operation;
  }
  private async commit(next: WorkspaceState, history = true) {
    if (next.project.mounts?.length) {
      const primary =
        next.project.mounts.find((m) => m.id === "primary") ??
        next.project.mounts[0];
      if (
        JSON.stringify(next.project.driver) !==
        JSON.stringify(this.state.project.driver)
      )
        primary.driver = structuredClone(next.project.driver);
      else next.project.driver = structuredClone(primary.driver);
    }
    parseProject(next.project);
    next.view = viewSchema.parse(next.view);
    if (history) {
      this.undoStack.push(structuredClone(this.state));
      if (this.undoStack.length > 50) this.undoStack.shift();
      this.redoStack = [];
    }
    next.revision = this.state.revision + 1;
    next.projectRevision =
      this.state.projectRevision +
      (JSON.stringify(next.project) !== JSON.stringify(this.state.project)
        ? 1
        : 0);
    next.updatedAt = new Date().toISOString();
    next.initialized = true;
    next.view.comparisons = next.view.comparisons.filter((id) =>
      next.snapshots.some((s) => s.id === id),
    );
    if (
      next.view.selectedPanel &&
      !buildGeometry(next.project).panels.some(
        (p) => p.id === next.view.selectedPanel,
      )
    )
      next.view.selectedPanel = null;
    await this.persist("workspace.json", next);
    this.state = next;
    this.emit("state", structuredClone(next));
    await this.persist("history.json", {
      undo: this.undoStack,
      redo: this.redoStack,
    });
  }
  async dispatch(input: Command): Promise<any> {
    const operation = this.queue.then(() => this.execute(input));
    this.queue = operation.catch(() => {});
    return operation;
  }
  private summary() {
    return {
      revision: this.state.revision,
      projectRevision: this.state.projectRevision,
      project: this.state.project,
      geometry: buildGeometry(this.state.project),
    };
  }
  private async checkedFile(filename: string, existing = false) {
    if (
      !filename ||
      path.isAbsolute(filename) ||
      filename.includes("\0") ||
      filename
        .split(/[\\/]/)
        .some((s) => s === ".." || s === "." || s.includes(":"))
    )
      throw new DomainError(
        "INVALID_PATH",
        "Use a relative filename within the workspace files directory.",
      );
    const result = path.resolve(this.files, filename),
      base = await fs.realpath(this.files);
    if (!result.startsWith(path.resolve(this.files) + path.sep))
      throw new DomainError("INVALID_PATH", "Path escapes the workspace.");
    let directory = this.files;
    for (const part of path
      .relative(this.files, path.dirname(result))
      .split(path.sep)
      .filter(Boolean)) {
      directory = path.join(directory, part);
      try {
        const real = await fs.realpath(directory);
        if (real !== base && !real.startsWith(base + path.sep))
          throw new DomainError(
            "INVALID_PATH",
            "Symlink directory escapes the workspace.",
          );
      } catch (error: any) {
        if (error.code !== "ENOENT") throw error;
        await fs.mkdir(directory);
      }
    }
    const parent = await fs.realpath(path.dirname(result));
    if (parent !== base && !parent.startsWith(base + path.sep))
      throw new DomainError(
        "INVALID_PATH",
        "Symlink directory escapes the workspace.",
      );
    try {
      const real = await fs.realpath(result);
      if (real !== base && !real.startsWith(base + path.sep))
        throw new DomainError(
          "INVALID_PATH",
          "Symlink file escapes the workspace.",
        );
    } catch (error: any) {
      if (error.code !== "ENOENT" || existing) throw error;
    }
    return result;
  }
  private async artifact(
    filename: string,
    data: Uint8Array | string,
    mimeType: string,
    projectRevision = this.state.projectRevision,
  ) {
    const destination = await this.reserveOutput(filename);
    await fs.writeFile(destination, data);
    return this.registerArtifact(destination, mimeType, projectRevision);
  }
  private async reserveOutput(filename: string) {
    const requested = await this.checkedFile(filename),
      parts = path.parse(requested);
    for (let i = 0; i < 1000; i++) {
      const destination = i
        ? path.join(parts.dir, parts.name + "-" + (i + 1) + parts.ext)
        : requested;
      try {
        const file = await fs.open(destination, "wx");
        await file.close();
        return destination;
      } catch (error: any) {
        if (error.code !== "EEXIST") throw error;
      }
    }
    throw new DomainError(
      "OUTPUT_LIMIT",
      "Too many files with this name. Choose another output filename.",
    );
  }
  private async registerArtifact(
    destination: string,
    mimeType: string,
    projectRevision = this.state.projectRevision,
  ) {
    const stat = await fs.stat(destination);
    const artifact: Artifact = {
      id: randomUUID(),
      name: path.basename(destination),
      path: destination,
      mimeType,
      size: stat.size,
      projectRevision,
      createdAt: new Date().toISOString(),
    };
    this.artifacts.set(artifact.id, artifact);
    await this.persist("artifacts.json", [...this.artifacts.values()]);
    return artifact;
  }
  private requireValid(analysis = false) {
    const g = buildGeometry(this.state.project);
    if ((analysis ? g.errors : (g.physicalErrors ?? g.errors)).length)
      throw new DomainError(
        "INVALID_GEOMETRY",
        analysis
          ? "A valid single route is required for 1D analysis. Use a 3D wave study for spatial layouts."
          : "Resolve physical geometry before manufacturing.",
        g.errors,
      );
    return g;
  }
  private compute<T = Simulation>(
    project: Project,
    samples = 240,
    kind = "simulation",
    args: Record<string, unknown> = { samples },
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(this.options.workerPath, {
        workerData: { kind, args, project: structuredClone(project) },
      });
      this.computations.add(worker);
      const finish = (error?: Error, result?: T) => {
        clearTimeout(timer);
        this.computations.delete(worker);
        void worker.terminate();
        if (error) reject(error);
        else resolve(result!);
      };
      const timer = setTimeout(
        () =>
          finish(
            new DomainError(
              "ANALYSIS_TIMEOUT",
              "Calculation exceeded two minutes; simplify the route/profile.",
            ),
          ),
        120000,
      );
      worker.on("message", (m) => {
        if (m.type === "done") finish(undefined, m.result);
        else if (m.type === "error")
          finish(new DomainError("SIMULATION_ERROR", m.error));
      });
      worker.once("error", finish);
      worker.once("exit", (code) => {
        if (this.computations.has(worker))
          finish(Error("Calculation worker exited early: " + code));
      });
    });
  }
  private async startJob(kind: string, args: any) {
    if (this.workers.size >= 3)
      throw new DomainError(
        "JOB_LIMIT",
        "At most three analysis jobs may run at once.",
      );
    if (
      kind === "field" &&
      [...this.jobs.values()].some(
        (j) => j.kind === "field" && j.status === "running",
      )
    )
      throw new DomainError(
        "JOB_LIMIT",
        "One spatial study may run at a time. Cancel the existing study first.",
      );
    if (!["sweep", "optimisation", "field"].includes(kind))
      this.requireValid(true);
    if (kind === "field" && args.backend === "webgpu" && !this.options.runField)
      throw new DomainError(
        "NO_GPU_DESKTOP",
        "WebGPU requires the live desktop.",
      );
    const job: AnalysisJob = {
      id: randomUUID(),
      kind,
      status: "running",
      progress: 0,
      projectRevision: this.state.projectRevision,
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);
    const project = structuredClone(this.state.project),
      controller = new AbortController();
    const external =
      kind === "field" && this.options.runField && args.backend !== "cpu";
    const worker = external
      ? null
      : new Worker(this.options.workerPath, {
          workerData: { kind, args, project },
        });
    const execution = worker ?? { terminate: async () => controller.abort() };
    this.workers.set(job.id, execution);
    const finish = async (
      status: AnalysisJob["status"],
      error?: string,
      result?: any,
    ) => {
      if (job.status !== "running") return;
      if (status === "completed" && kind === "field") {
        const artifact = await this.artifact(
          "fields/" + job.id + ".aegir-field.zip",
          encodeField(result),
          "application/zip",
          job.projectRevision,
        );
        if (job.status !== "running") return;
        this.fieldCache.set(job.id, result);
        while (this.fieldCache.size > 2)
          this.fieldCache.delete(this.fieldCache.keys().next().value!);
        result = { artifact, meta: result.meta };
      }
      job.status = status;
      job.error = error;
      job.result = result;
      job.progress = status === "completed" ? 1 : job.progress;
      job.finishedAt = new Date().toISOString();
      this.workers.delete(job.id);
      await execution.terminate();
      await this.persist("jobs.json", [...this.jobs.values()]);
      this.emit("job", structuredClone(job));
    };
    let finalizing = false;
    const complete = (
      status: AnalysisJob["status"],
      error?: string,
      result?: unknown,
    ) => {
      if (finalizing) return;
      finalizing = true;
      void finish(status, error, result).catch((e) => {
        if (job.status === "running") {
          job.status = "failed";
          job.error = e.message;
          job.finishedAt = new Date().toISOString();
          this.workers.delete(job.id);
          void execution.terminate();
        }
        this.emit("diagnostic", "Job finalization: " + e.message);
        this.emit("job", structuredClone(job));
      });
    };
    const progress = (value: number, valid?: number) => {
      if (job.status !== "running") return;
      job.progress = value;
      job.valid = valid;
      this.emit("job", { ...job, result: undefined });
    };
    if (worker) {
      worker.on("message", (m) => {
        if (m.type === "progress") progress(m.progress, m.valid);
        else if (m.type === "done") complete("completed", undefined, m.result);
        else if (m.type === "error") complete("failed", m.error);
      });
      worker.on("error", (e) => complete("failed", (e as Error).message));
      worker.on("exit", (code) => {
        if (job.status === "running" && !finalizing)
          complete(
            "failed",
            "Worker exited before returning a result (code " + code + ").",
          );
      });
    } else
      void this.options.runField!(
        job.id,
        project,
        args,
        progress,
        controller.signal,
      )
        .then((result) => complete("completed", undefined, result))
        .catch((error) => complete("failed", error.message));
    while (this.jobs.size > 24) {
      const key =
        [...this.jobs.values()].find(
          (v) =>
            v.status !== "running" &&
            v.id !== this.state.view.field.jobId &&
            v.kind !== "field",
        )?.id ??
        [...this.jobs.values()].find(
          (v) => v.status !== "running" && v.id !== this.state.view.field.jobId,
        )?.id;
      if (!key) break;
      this.jobs.delete(key);
    }
    await this.persist("jobs.json", [...this.jobs.values()]);
    this.emit("job", { ...job, result: undefined });
    return { ...job };
  }
  private async fieldResult(id: string) {
    const job = this.jobs.get(id);
    if (!job || job.kind !== "field" || job.status !== "completed")
      throw new DomainError(
        "FIELD_NOT_READY",
        "A completed spatial study is required. Poll job.get first.",
      );
    let result = this.fieldCache.get(id);
    if (!result) {
      const artifact = this.artifacts.get(job.result?.artifact?.id);
      if (!artifact)
        throw new DomainError("NOT_FOUND", "Field recording is unavailable.");
      const filename = await this.checkedFile(
        path.relative(this.files, artifact.path),
        true,
      );
      result = decodeField(new Uint8Array(await fs.readFile(filename)));
      this.fieldCache.set(id, result);
      while (this.fieldCache.size > 2)
        this.fieldCache.delete(this.fieldCache.keys().next().value!);
    }
    return { job, result };
  }
  private async execute(command: Command): Promise<any> {
    if (!command || !Object.hasOwn(commands, command.name))
      throw new DomainError("UNKNOWN_COMMAND", "Unknown ÆGIR command.");
    const definition = commands[command.name],
      args: any = definition.schema.parse(command.args ?? {}),
      read = "read" in definition && definition.read;
    if (
      !read &&
      command.expectedRevision !== undefined &&
      command.expectedRevision !== this.state.revision
    )
      throw new DomainError(
        "REVISION_CONFLICT",
        "Workspace changed; read it again before editing.",
        { expected: command.expectedRevision, actual: this.state.revision },
      );
    if (
      !read &&
      command.expectedProjectRevision !== undefined &&
      command.expectedProjectRevision !== this.state.projectRevision
    )
      throw new DomainError(
        "REVISION_CONFLICT",
        "Project changed; refresh before editing.",
        {
          expected: command.expectedProjectRevision,
          actual: this.state.projectRevision,
        },
      );
    const next = structuredClone(this.state),
      p = next.project;
    switch (command.name) {
      case "workspace.batch": {
        const draft = new DesignService(this.options);
        draft.state = structuredClone(this.state);
        draft.persist = async () => {};
        const allowed =
          /^(project\.(new|replace|patch)|layout\.(set|convert)|cabinet\.set|baffle\.(upsert|remove)|route\.(set|trace)|mouth\.set|driver\.(set|select)|mount\.(upsert|remove)|library\.(upsert|remove|replace)|snapshot\.(create|restore|remove|replace)|view\.set)$/;
        for (const item of args.commands) {
          if (!allowed.test(item.name))
            throw new DomainError(
              "BATCH_OPERATION",
              "Operation is not allowed in atomic edits: " + item.name,
            );
          await draft.execute(item);
        }
        if (
          args.requireValidGeometry &&
          (
            buildGeometry(draft.state.project).physicalErrors ??
            buildGeometry(draft.state.project).errors
          ).length
        )
          throw new DomainError(
            "INVALID_GEOMETRY",
            "Atomic edit has geometry errors.",
            buildGeometry(draft.state.project).errors,
          );
        await this.commit(draft.state);
        return structuredClone(this.state);
      }
      case "status.get":
        return {
          name: "ÆONFORGE ÆGIR",
          revision: this.state.revision,
          projectRevision: this.state.projectRevision,
          filesDirectory: this.files,
          liveDesktop: Boolean(this.options.capture),
          cadAvailable: this.options.cadStatus
            ? await this.options.cadStatus()
            : false,
          model:
            "Fast geometry-derived 1D line model plus experimental 3D linear FDTD field studies with coupled T/S pistons and exterior PML. Up to 8 drivers. No calibrated stuffing, nonlinear or structural prediction.",
          runningJobs: this.workers.size,
        };
      case "workspace.get":
        return structuredClone(this.state);
      case "workspace.bootstrap":
        if (this.state.initialized) return structuredClone(this.state);
        next.project = parseProject(args.project);
        next.library = args.library;
        next.snapshots = args.snapshots;
        break;
      case "project.new":
        next.project = structuredClone(defaultProject);
        if (args.name !== undefined) next.project.name = args.name;
        if (args.driverId) {
          const driver = [...drivers, ...next.library].find(
            (d) => d.id === args.driverId,
          );
          if (!driver) throw new DomainError("NOT_FOUND", "Unknown driver.");
          next.project.driver = driver;
        }
        break;
      case "project.replace":
        next.project = parseProject(args.project);
        if (
          args.requireValidGeometry &&
          (
            buildGeometry(next.project).physicalErrors ??
            buildGeometry(next.project).errors
          ).length
        )
          throw new DomainError(
            "INVALID_GEOMETRY",
            "Replacement has geometry errors.",
            buildGeometry(next.project).errors,
          );
        break;
      case "project.patch":
        if (args.name !== undefined) p.name = args.name;
        for (const key of ["driver", "design", "targets"] as const)
          if (args[key]) Object.assign(p[key], args[key]);
        for (const key of ["layout", "mounts"] as const)
          if (args[key] !== undefined) {
            if (args[key] === null) delete p[key];
            else (p as any)[key] = args[key];
          }
        break;
      case "project.inspect":
        return this.summary();
      case "project.validate": {
        const g = buildGeometry(p);
        let result: Simulation | undefined, error: string | undefined;
        try {
          if (!g.errors.length) result = await this.compute(p, 80);
        } catch (e) {
          error = (e as Error).message;
        }
        const sources = result ? sourceHeadroom(p, result) : [];
        return {
          valid: g.errors.length === 0 && !error,
          physicalValid: (g.physicalErrors ?? g.errors).length === 0,
          analysisAvailable: g.errors.length === 0,
          physicalErrors: g.physicalErrors ?? g.errors,
          analysisErrors: g.analysisErrors ?? [],
          errors: [...g.errors, ...(error ? [error] : [])],
          warnings: [
            ...g.warnings,
            ...sources
              .filter((s) => s.ratio > 1)
              .map(
                (s) =>
                  `Driver ${s.id} exceeds Xmax in the target band (${(s.ratio * 100).toFixed(1)}%).`,
              ),
            ...(result &&
            result.points.some(
              (v) =>
                v.frequency >= p.targets.low &&
                v.frequency <= p.targets.high &&
                v.velocity > p.targets.maxVelocity,
            )
              ? ["Mouth velocity exceeds the target-band limit."]
              : []),
          ],
          lineLength: g.lineLength,
          clearVolume: g.airVolume,
          metrics: result
            ? {
                bandMean: result.bandMean,
                ripple: result.ripple,
                f3: result.f3,
                peakExcursion: result.peakExcursion,
                peakVelocity: result.peakVelocity,
                planeWaveLimit: result.planeWaveLimit,
                radiationLimit: result.radiationLimit,
                impedanceConvention:
                  result.impedanceConvention ?? "common-parallel-input",
                sources,
              }
            : null,
        };
      }
      case "project.save":
        return this.artifact(
          args.filename,
          JSON.stringify(p, null, 2),
          "application/json",
        );
      case "project.open":
        next.project = parseProject(
          JSON.parse(
            await fs.readFile(
              await this.checkedFile(args.filename, true),
              "utf8",
            ),
          ),
        );
        break;
      case "layout.convert":
        next.project = editableLayout(p);
        break;
      case "layout.set":
        p.layout = args.layout;
        break;
      case "cabinet.set":
        next.project = editableLayout(p);
        Object.assign(next.project.layout!, args);
        break;
      case "baffle.upsert": {
        next.project = editableLayout(p);
        const b = next.project.layout!.baffles,
          i = b.findIndex((v) => v.id === args.baffle.id);
        if (i < 0) b.push(args.baffle);
        else b[i] = args.baffle;
        break;
      }
      case "baffle.remove": {
        next.project = editableLayout(p);
        const b = next.project.layout!.baffles;
        if (!b.some((v) => v.id === args.id))
          throw new DomainError("NOT_FOUND", "Unknown baffle.");
        next.project.layout!.baffles = b.filter((v) => v.id !== args.id);
        break;
      }
      case "route.set":
        next.project = editableLayout(p);
        next.project.layout!.route = args.points;
        break;
      case "route.trace":
        next.project = editableLayout(p);
        next.project.layout!.route = traceRoute(
          next.project,
          args.start ?? next.project.layout!.route[0],
          args.cellSize ?? 10,
        );
        break;
      case "mouth.set":
        next.project = editableLayout(p);
        next.project.layout!.mouth = args.mouth;
        break;
      case "driver.set":
        Object.assign(p.driver, args.parameters);
        if (p.mounts?.some((m) => m.id === "primary"))
          p.mounts.find((m) => m.id === "primary")!.driver = structuredClone(
            p.driver,
          );
        break;
      case "library.list":
        return { examples: drivers, stored: next.library };
      case "library.upsert": {
        const v = parseDriver(args.driver);
        validateProject({ ...p, driver: v, mounts: undefined });
        next.library = next.library.filter((d) => d.id !== v.id);
        next.library.push(v);
        break;
      }
      case "library.remove":
        next.library = next.library.filter((d) => d.id !== args.id);
        break;
      case "library.replace":
        for (const d of args.drivers)
          validateProject({ ...p, driver: d, mounts: undefined });
        next.library = args.drivers;
        break;
      case "driver.select": {
        const d = [...drivers, ...next.library].find((v) => v.id === args.id);
        if (!d) throw new DomainError("NOT_FOUND", "Unknown driver ID.");
        p.driver = structuredClone(d);
        if (p.mounts?.some((m) => m.id === "primary"))
          p.mounts.find((m) => m.id === "primary")!.driver = structuredClone(d);
        break;
      }
      case "mount.upsert": {
        next.project = editableLayout(p);
        const mounts = next.project.mounts ?? [
          {
            id: "primary",
            driver: structuredClone(p.driver),
            position: p.design.driverPosition,
            face: "front",
            voltageScale: 1,
            phase: 0,
          },
        ];
        const index = mounts.findIndex((m) => m.id === args.mount.id),
          primary = mounts.find((m) => m.id === "primary") ?? mounts[0];
        next.project.mounts = mounts.slice();
        if (index >= 0) next.project.mounts[index] = args.mount;
        else next.project.mounts.push(args.mount);
        if (args.mount.id === primary.id)
          next.project.driver = structuredClone(args.mount.driver);
        break;
      }
      case "mount.remove": {
        if (!p.mounts?.some((m) => m.id === args.id))
          throw new DomainError("NOT_FOUND", "Unknown driver mount.");
        if (p.mounts.length === 1)
          throw new DomainError(
            "LAST_DRIVER",
            "At least one source must remain.",
          );
        p.mounts = p.mounts.filter((m) => m.id !== args.id);
        p.driver = structuredClone(
          (p.mounts.find((m) => m.id === "primary") ?? p.mounts[0]).driver,
        );
        break;
      }
      case "snapshot.create":
        if (next.snapshots.length >= 32)
          throw new DomainError("LIMIT", "At most 32 saved studies.");
        next.snapshots.push({
          id: randomUUID(),
          name: args.name,
          project: structuredClone(p),
          color: args.color ?? "#94b9dd",
        });
        break;
      case "snapshot.list":
        return next.snapshots;
      case "snapshot.restore": {
        const snapshot = next.snapshots.find((s) => s.id === args.id);
        if (!snapshot) throw new DomainError("NOT_FOUND", "Unknown study.");
        next.project = structuredClone(snapshot.project);
        break;
      }
      case "snapshot.remove":
        next.snapshots = next.snapshots.filter((s) => s.id !== args.id);
        break;
      case "snapshot.replace":
        next.snapshots = args.snapshots;
        break;
      case "history.undo": {
        const before = this.undoStack.pop();
        if (!before) throw new DomainError("NO_HISTORY", "Nothing to undo.");
        this.redoStack.push(structuredClone(this.state));
        await this.commit(before, false);
        return this.summary();
      }
      case "history.redo": {
        const after = this.redoStack.pop();
        if (!after) throw new DomainError("NO_HISTORY", "Nothing to redo.");
        this.undoStack.push(structuredClone(this.state));
        await this.commit(after, false);
        return this.summary();
      }
      case "view.get":
        return next.view;
      case "view.set": {
        const field = args.field
          ? { ...next.view.field, ...args.field }
          : next.view.field;
        Object.assign(next.view, args);
        next.view.field = field;
        if (field.jobId) {
          const study = this.jobs.get(field.jobId);
          if (!study || study.kind !== "field")
            throw new DomainError(
              "NOT_FOUND",
              "Selected spatial study does not exist.",
            );
          if (
            study.status === "completed" &&
            field.frame > study.result.meta.times.length - 1
          )
            throw new DomainError(
              "FRAME_RANGE",
              "Frame index exceeds the selected study.",
            );
        }
        if (
          args.selectedPanel &&
          !buildGeometry(p).panels.some((v) => v.id === args.selectedPanel)
        )
          throw new DomainError("NOT_FOUND", "Panel selection does not exist.");
        if (
          args.comparisons?.some(
            (id: string) => !next.snapshots.some((s) => s.id === id),
          )
        )
          throw new DomainError(
            "NOT_FOUND",
            "Comparison selection does not exist.",
          );
        await this.commit(next, false);
        return structuredClone(this.state);
      }
      case "view.capture": {
        if (!this.options.capture)
          throw new DomainError(
            "NO_DESKTOP",
            "A live desktop is required for screenshots.",
          );
        const png = await this.options.capture(
          args.region ?? "window",
          this.state.revision,
        );
        return this.artifact(
          "captures/" + Date.now() + "-" + (args.region ?? "window") + ".png",
          png,
          "image/png",
        );
      }
      case "field.capabilities":
        return {
          cpu: true,
          desktop: Boolean(this.options.runField),
          gpu: this.options.fieldCapabilities?.() ?? null,
          maxCells: 4000000,
          maxRecordingFrames: 640,
          maxRecordingBytes: 15 * 1024 * 1024,
          volumeRecording: true,
          particleRecording: true,
          cpuMaxCellUpdates: 300000000,
          gpuMaxCellUpdates: 15000000000,
          model:
            "Experimental 3D linear FDTD, rigid solids and two-way T/S piston coupling, exterior split-field PML. No calibrated stuffing, structural/nonlinear model or physical validation.",
        };
      case "field.run": {
        const job = await this.startJob("field", args.settings ?? {});
        if (args.show !== false) {
          next.view.tab = "field";
          next.view.field = {
            ...next.view.field,
            jobId: job.id,
            frame: 0,
            playing: false,
            range: 0,
          };
          await this.commit(next, false);
        }
        return job;
      }
      case "field.open": {
        await this.fieldResult(args.id);
        next.view.tab = "field";
        next.view.field = {
          ...next.view.field,
          jobId: args.id,
          frame: 0,
          playing: false,
          range: 0,
        };
        await this.commit(next, false);
        return structuredClone(this.state);
      }
      case "field.result": {
        const { job, result } = await this.fieldResult(args.id),
          { meta, data, mask } = result,
          output: any = {
            id: job.id,
            projectRevision: job.projectRevision,
            stale: job.projectRevision !== this.state.projectRevision,
            meta,
            artifact: job.result.artifact,
          };
        if (args.frame !== undefined) {
          if (args.frame >= meta.times.length)
            throw new DomainError(
              "FRAME_RANGE",
              "Frame index exceeds this recording.",
            );
          const { width, height } = meta.plane,
            stride = Math.max(1, Math.ceil(Math.sqrt((width * height) / 4096))),
            values: number[] = [],
            air: number[] = [];
          for (let y = 0; y < height; y += stride)
            for (let x = 0; x < width; x += stride) {
              const at = (args.frame * width * height + y * width + x) * 4;
              values.push(...data.subarray(at, at + 4));
              air.push(mask[y * width + x]);
            }
          output.frame = {
            index: args.frame,
            time: meta.times[args.frame],
            width: Math.ceil(width / stride),
            height: Math.ceil(height / stride),
            stride,
            components: ["pressure_pa", "vx_m_s", "vy_m_s", "vz_m_s"],
            data: values,
            air,
          };
        }
        if (args.traces) {
          const stride = Math.max(1, Math.ceil(meta.steps / 1000)),
            times: number[] = [],
            sources = meta.sources.map((s) => ({
              id: s.id,
              xMm: [] as number[],
              velocity: [] as number[],
              current: [] as number[],
              voltage: [] as number[],
            })),
            probes = meta.probes.map((s) => ({
              name: s.name,
              pressure: [] as number[],
            }));
          for (let i = 0; i < meta.steps; i += stride) {
            times.push((i + 1) * meta.dt);
            sources.forEach((s, d) => {
              const a =
                meta.layout.driverOffset + (i * meta.sources.length + d) * 4;
              s.xMm.push(data[a] * 1000);
              s.velocity.push(data[a + 1]);
              s.current.push(data[a + 2]);
              s.voltage.push(data[a + 3]);
            });
            probes.forEach((p, k) =>
              p.pressure.push(
                data[meta.layout.probeOffset + i * meta.probes.length + k],
              ),
            );
          }
          output.traces = {
            times,
            electricalTimes: times.map((t: number) => t - meta.dt / 2),
            stride,
            sources,
            probes,
          };
        }
        return output;
      }
      case "analysis.run":
        return this.startJob("simulation", args);
      case "analysis.sweep":
        return this.startJob("sweep", args);
      case "analysis.optimise":
        return this.startJob("optimisation", args);
      case "analysis.pressure":
        this.requireValid(true);
        return {
          frequency: args.frequency,
          points: await this.compute(p, 0, "pressure", args),
        };
      case "analysis.compare": {
        const projects = [
          { id: "current", name: p.name, project: p },
          ...args.ids.map((id: string) => {
            const s = next.snapshots.find((s) => s.id === id);
            if (!s)
              throw new DomainError("NOT_FOUND", "Unknown comparison " + id);
            return s;
          }),
        ];
        return this.startJob("compare", { ...args, projects });
      }
      case "job.get": {
        const job = this.jobs.get(args.id);
        if (!job) throw new DomainError("NOT_FOUND", "Unknown job.");
        return args.includeResult
          ? structuredClone(job)
          : { ...job, result: undefined };
      }
      case "job.list":
        return [...this.jobs.values()].map((job) => ({
          ...job,
          result: undefined,
        }));
      case "job.cancel": {
        const job = this.jobs.get(args.id),
          worker = this.workers.get(args.id);
        if (!job) throw new DomainError("NOT_FOUND", "Unknown job.");
        if (job.status === "running") {
          job.status = "cancelled";
          job.finishedAt = new Date().toISOString();
          this.workers.delete(job.id);
          await worker?.terminate();
          await this.persist("jobs.json", [...this.jobs.values()]);
          this.emit("job", job);
        }
        return { ...job, result: undefined };
      }
      case "job.apply": {
        const job = this.jobs.get(args.id);
        if (!job || job.status !== "completed" || job.kind !== "optimisation")
          throw new DomainError(
            "JOB_NOT_READY",
            "A completed optimisation job is required.",
          );
        if (
          job.projectRevision !== this.state.projectRevision &&
          !args.allowStale
        )
          throw new DomainError(
            "STALE_RESULT",
            "Project changed since this search. Rerun it or explicitly allowStale.",
          );
        const candidate = job.result?.[args.candidate ?? 0];
        if (!candidate)
          throw new DomainError("NOT_FOUND", "No candidate at that index.");
        next.project = structuredClone(candidate.project);
        break;
      }
      case "export.create":
        return this.export(args.format, args.filename);
      case "artifact.list":
        return [...this.artifacts.values()];
      case "artifact.read": {
        const artifact = this.artifacts.get(args.id);
        if (!artifact) throw new DomainError("NOT_FOUND", "Unknown artifact.");
        const relative = path.relative(this.files, artifact.path);
        const file = await this.checkedFile(relative, true);
        if (args.offset !== undefined || args.length !== undefined) {
          const offset = args.offset ?? 0,
            length = args.length ?? 1048576,
            handle = await fs.open(file, "r");
          try {
            const stat = await handle.stat();
            if (offset > stat.size)
              throw new DomainError(
                "ARTIFACT_RANGE",
                "Offset exceeds artifact size.",
              );
            const buffer = Buffer.alloc(Math.min(length, stat.size - offset));
            const { bytesRead } = await handle.read(
                buffer,
                0,
                buffer.length,
                offset,
              ),
              next = offset + bytesRead;
            return {
              ...artifact,
              encoding: "base64",
              data: buffer.subarray(0, bytesRead).toString("base64"),
              offset,
              length: bytesRead,
              totalSize: stat.size,
              nextOffset: next < stat.size ? next : null,
              complete: next >= stat.size,
            };
          } finally {
            await handle.close();
          }
        }
        if (artifact.size > 16 * 1024 * 1024)
          throw new DomainError(
            "ARTIFACT_LARGE",
            "Artifact exceeds 16 MiB inline limit; use offset/length chunks or its local path.",
          );
        const buffer = await fs.readFile(file);
        return {
          ...artifact,
          encoding:
            artifact.mimeType.startsWith("text/") ||
            artifact.mimeType === "application/json"
              ? "utf8"
              : "base64",
          data:
            artifact.mimeType.startsWith("text/") ||
            artifact.mimeType === "application/json"
              ? buffer.toString("utf8")
              : buffer.toString("base64"),
        };
      }
      default:
        throw new DomainError("NOT_IMPLEMENTED", "Command is not implemented.");
    }
    await this.commit(next);
    return structuredClone(this.state);
  }
  async export(format: string, filename?: string) {
    const p = this.state.project,
      name = safeName(p.name),
      g = format === "project" ? buildGeometry(p) : this.requireValid();
    const ext: Record<string, string> = {
      project: ".aegir.json",
      response: "-response.csv",
      bundle: "-build.zip",
      manifest: "-geometry.json",
      scad: ".scad",
      cadquery: ".py",
      report: "-report.md",
      step: ".step",
    };
    const output = filename ?? name + ext[format];
    if (format === "project")
      return this.artifact(
        output,
        JSON.stringify(p, null, 2),
        "application/json",
      );
    if (format === "manifest")
      return this.artifact(
        output,
        JSON.stringify({ project: p, panels: g.panels }, null, 2),
        "application/json",
      );
    if (format === "scad")
      return this.artifact(output, openScad(p), "text/plain");
    if (format === "cadquery")
      return this.artifact(output, cadQueryScript(p), "text/x-python");
    if (format === "step") {
      if (!this.options.exportStep)
        throw new DomainError("NO_CAD", "STEP backend is unavailable.");
      const destination = await this.reserveOutput(output);
      try {
        await this.options.exportStep(
          { project: p, panels: g.panels },
          destination,
        );
        return await this.registerArtifact(destination, "model/step");
      } catch (error) {
        await fs.unlink(destination).catch(() => {});
        throw error;
      }
    }
    if (format === "report" && g.errors.length)
      return this.artifact(
        output,
        `# ÆGIR cabinet report: ${p.name}\n\nProject revision ${this.state.projectRevision}. Cabinet ${g.width} × ${g.height} × ${g.depth} mm; ${g.airVolume.toFixed(2)} L clear cavity; ${g.mounts.length} drivers.\n\nThe physical geometry is valid for CAD. A single-route 1D response is unavailable:\n${g.errors.map((e) => "- " + e).join("\n")}\n\nRun a 3D wave study using the actual solids. Sources remain linear rigid pistons; no crossover, cone breakup, structural vibration or calibrated stuffing.\n\n## Stock schedule\n\n\`\`\`csv\n${cutList(p)}\`\`\`\n`,
        "text/markdown",
      );
    if (format === "bundle" && g.errors.length)
      return this.artifact(output, makeBundle(p), "application/zip");
    const result = await this.compute(p);
    if (format === "response")
      return this.artifact(output, responseCsv(result), "text/csv");
    if (format === "bundle")
      return this.artifact(output, makeBundle(p, result), "application/zip");
    if (format === "report")
      return this.artifact(
        output,
        `# ÆGIR engineering report: ${p.name}\n\nProject revision ${this.state.projectRevision}.\n\nCabinet: ${g.width.toFixed(2)} × ${g.height.toFixed(2)} × ${g.depth.toFixed(2)} mm. Route ${g.lineLength.toFixed(4)} m; cavity ${g.airVolume.toFixed(2)} L; ${g.panels.length} panels; ${g.mounts.length} source(s).\n\nBand ${p.targets.low}–${p.targets.high} Hz at ${p.design.voltage} V RMS: mean ${result.bandMean.toFixed(2)} dB, ripple ${result.ripple.toFixed(2)} dB, F3 ${result.f3?.toFixed(2) ?? "unresolved"} Hz. Sweep peaks: excursion ${result.peakExcursion.toFixed(3)} mm, mouth velocity ${result.peakVelocity.toFixed(3)} m/s.\n\n## Driver headroom (target band)\n\n${sourceHeadroom(
          p,
          result,
        )
          .map(
            (s) =>
              `- ${s.id}: ${s.peakExcursion.toFixed(3)} mm peak / ${s.xmax} mm Xmax (${(s.ratio * 100).toFixed(1)}%).`,
          )
          .join(
            "\n",
          )}\n\nImpedance convention: ${result.impedanceConvention ?? "common-parallel-input"}.\n\n## Panel stock schedule\n\n\`\`\`csv\n${cutList(p)}\`\`\`\n\n## Model and machining limits\n\n${g.warnings.map((v) => "- " + v).join("\n")}\n\n${g.panels.flatMap((v) => (v.notes ?? []).map((n) => "- " + v.id + ": " + n)).join("\n")}\n\nLinear geometry-derived 1D model, ideal co-located half-space radiation at 1 m; not physical validation, room prediction, nonlinear distortion or a CNC toolpath. Use prototype measurements before committing a final design.\n`,
        "text/markdown",
      );
    throw new DomainError("UNKNOWN_FORMAT", "Unsupported export format.");
  }
  async close() {
    for (const worker of this.computations) await worker.terminate();
    for (const [id, worker] of this.workers) {
      const job = this.jobs.get(id);
      if (job?.status === "running") {
        job.status = "interrupted";
        job.finishedAt = new Date().toISOString();
        job.error = "Service stopped before this worker completed.";
      }
      await worker.terminate();
    }
    this.workers.clear();
    await this.persist("jobs.json", [...this.jobs.values()]);
    await Promise.allSettled(this.writes.values());
  }
}
