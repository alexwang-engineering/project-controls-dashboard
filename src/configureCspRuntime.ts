interface ZodRuntimeGlobal {
  __zod_globalConfig?: {
    jitless?: boolean;
  };
}

const zodRuntime = globalThis as unknown as ZodRuntimeGlobal;
zodRuntime.__zod_globalConfig ??= {};
zodRuntime.__zod_globalConfig.jitless = true;
