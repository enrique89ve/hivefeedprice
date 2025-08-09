import { PriceProvider } from "@/types/price-provider";
import {
  STATIC_PROVIDERS,
  type StaticProviderConfig,
} from "@/providers/static-providers";

export interface ProviderConfig {
  name: string;
  enabled: boolean;
  weight: number;
  timeout?: number;
  maxRetries?: number;
}

export interface ProviderDescriptor {
  readonly name: string;
  readonly module: string;
  readonly exportName?: string;
  readonly enabled: boolean;
  readonly weight: number;
  readonly timeout?: number;
  readonly maxRetries?: number;
}

const customFactories: Map<string, () => PriceProvider> = new Map();
const customDescriptors: Map<string, ProviderDescriptor> = new Map();

function toKey(name: string): string {
  return name.toLowerCase();
}

function parseModulesJson(jsonStr: string): ProviderDescriptor[] {
  const arr = JSON.parse(jsonStr) as Array<
    Partial<ProviderDescriptor> & { name: string; module: string }
  >;
  return arr.map((item) => ({
    name: item.name,
    module: item.module,
    enabled: item.enabled ?? true,
    weight: item.weight ?? 1.0,
    ...(item.exportName !== undefined ? { exportName: item.exportName } : {}),
    ...(item.timeout !== undefined ? { timeout: item.timeout } : {}),
    ...(item.maxRetries !== undefined ? { maxRetries: item.maxRetries } : {}),
  }));
}

function loadDescriptorOverridesFromEnv(): ProviderDescriptor[] {
  const mods = process.env.HIVE_PRICE_PROVIDER_MODULES;
  if (!mods) return [];
  const isJson = mods.trim().startsWith("[");
  try {
    return isJson ? parseModulesJson(mods) : [];
  } catch {
    console.log("\x1b[33m[WARN]\x1b[0m Invalid HIVE_PRICE_PROVIDER_MODULES format. Ignoring.");
    return [];
  }
}

function loadStaticDescriptors(): ProviderDescriptor[] {
  const fromStatic: ProviderDescriptor[] = (
    STATIC_PROVIDERS as readonly StaticProviderConfig[]
  ).map((p) => ({
    name: p.name,
    module: p.module,
    enabled: p.enabled ?? true,
    weight: p.weight ?? 1.0,
    ...(p.exportName !== undefined ? { exportName: p.exportName } : {}),
    ...(p.timeout !== undefined ? { timeout: p.timeout } : {}),
    ...(p.maxRetries !== undefined ? { maxRetries: p.maxRetries } : {}),
  }));
  return fromStatic;
}

function getAllDescriptors(): Map<string, ProviderDescriptor> {
  const map = new Map<string, ProviderDescriptor>();
  for (const d of loadStaticDescriptors()) {
    map.set(toKey(d.name), d);
  }
  for (const d of customDescriptors.values()) {
    map.set(toKey(d.name), d);
  }
  for (const d of loadDescriptorOverridesFromEnv()) {
    map.set(toKey(d.name), d);
  }
  return map;
}

export class ProviderRegistry {
  static registerProvider(name: string, factory: () => PriceProvider): void {
    customFactories.set(toKey(name), factory);
  }

  static registerDescriptor(descriptor: ProviderDescriptor): void {
    customDescriptors.set(toKey(descriptor.name), descriptor);
  }

  static getProvider(name: string): PriceProvider | null {
    const desc = getAllDescriptors().get(toKey(name));
    if (desc) {
      return new LazyModuleProvider(desc);
    }

    const customFactory = customFactories.get(toKey(name));
    if (customFactory) {
      return customFactory();
    }

    return null;
  }

  static getAvailableProviders(): string[] {
    return [
      ...Array.from(getAllDescriptors().keys()),
      ...Array.from(customFactories.keys()),
    ];
  }
}

class LazyModuleProvider extends PriceProvider {
  readonly exchangeName: string;
  readonly baseUrl = "";
  private readonly descriptor: ProviderDescriptor;
  private realProvider: PriceProvider | null = null;

  constructor(descriptor: ProviderDescriptor) {
    super();
    this.descriptor = descriptor;
    this.exchangeName = descriptor.name;
  }

  private async ensureReal(): Promise<PriceProvider> {
    if (this.realProvider) return this.realProvider;
    const mod = (await import(this.descriptor.module)) as Record<
      string,
      unknown
    >;
    const Ctor = this.descriptor.exportName
      ? (mod[this.descriptor.exportName] as unknown)
      : (mod as { default?: unknown }).default ?? undefined;
    if (typeof Ctor !== "function") {
      throw new Error(
        `Provider export not found for ${this.exchangeName} at ${
          this.descriptor.module
        }${this.descriptor.exportName ? "#" + this.descriptor.exportName : ""}`
      );
    }
    const instance = new (Ctor as new () => PriceProvider)();
    const configOptions: {
      requestTimeout?: number;
      retryAttempts?: number;
      maxRetries?: number;
    } = {};
    if (this.descriptor.timeout !== undefined) {
      configOptions.requestTimeout = this.descriptor.timeout;
    }
    if (this.descriptor.maxRetries !== undefined) {
      configOptions.retryAttempts = this.descriptor.maxRetries;
      configOptions.maxRetries = this.descriptor.maxRetries;
    }
    instance.configure(configOptions);
    this.realProvider = instance;
    return instance;
  }

  async getHivePrice(): Promise<number> {
    const provider = await this.ensureReal();
    return provider.getHivePrice();
  }
}

function computeActiveConfig(): ProviderConfig[] {
  if (STATIC_PROVIDERS && STATIC_PROVIDERS.length > 0) {
    return STATIC_PROVIDERS.filter((p) => p.enabled !== false).map((p) => ({
      name: p.name,
      enabled: p.enabled ?? true,
      weight: p.weight ?? 1.0,
      ...(p.timeout !== undefined ? { timeout: p.timeout } : {}),
      ...(p.maxRetries !== undefined ? { maxRetries: p.maxRetries } : {}),
    }));
  }

  const providersEnv = process.env.HIVE_PRICE_PROVIDERS;
  if (providersEnv) {
    try {
      const config: ProviderConfig[] = JSON.parse(providersEnv);
      return config;
    } catch {
      console.log("\x1b[33m[WARN]\x1b[0m Invalid HIVE_PRICE_PROVIDERS format. Using empty config.");
    }
  }

  return [];
}

export function getActiveProvidersConfig(): ProviderConfig[] {
  return computeActiveConfig();
}

export function createProvidersFromConfig(
  config?: ProviderConfig[]
): PriceProvider[] {
  const providersConfig = config ?? computeActiveConfig();
  const providers: PriceProvider[] = [];

  const seen = new Set<string>();
  for (const providerConfig of providersConfig) {
    if (!providerConfig.enabled) continue;
    const key = toKey(providerConfig.name);
    if (seen.has(key)) continue;
    seen.add(key);

    const provider = ProviderRegistry.getProvider(providerConfig.name);
    if (!provider) {
      console.warn(`Provider '${providerConfig.name}' not found. Skipping.`);
      continue;
    }

    if (typeof (provider as PriceProvider).configure === "function") {
      (provider as PriceProvider).configure({
        ...(providerConfig.timeout !== undefined
          ? { requestTimeout: providerConfig.timeout }
          : {}),
        ...(providerConfig.maxRetries !== undefined
          ? {
              retryAttempts: providerConfig.maxRetries,
              maxRetries: providerConfig.maxRetries,
            }
          : {}),
      });
    }

    providers.push(provider);
  }

  if (providers.length === 0) {
    throw new Error("No valid providers found in configuration");
  }

  return providers;
}

export function loadProvidersFromEnv(): PriceProvider[] {
  const descriptorsFromEnv = loadDescriptorOverridesFromEnv();
  for (const d of descriptorsFromEnv) {
    ProviderRegistry.registerDescriptor(d);
  }

  return createProvidersFromConfig();
}
