import { pandaScoreProvider } from "./pandascore-provider";
import { riotProvider } from "./riot-provider";
import type { DataProvider, DataProviderSyncResult } from "./types";

const providers: Record<string, DataProvider> = {
  [pandaScoreProvider.id]: pandaScoreProvider,
  [riotProvider.id]: riotProvider,
};

const DEFAULT_PROVIDER_ID = pandaScoreProvider.id;

export function listDataProviders(): Array<{ id: string; name: string; configured: boolean }> {
  return Object.values(providers).map((provider) => ({
    id: provider.id,
    name: provider.name,
    configured: provider.isConfigured(),
  }));
}

export function resolvePrimaryDataProviderId(): string {
  const configured = process.env.DATA_PROVIDER_PRIMARY?.trim().toLowerCase();

  if (configured && providers[configured]) {
    return configured;
  }

  return DEFAULT_PROVIDER_ID;
}

export async function syncFromPrimaryProvider(): Promise<DataProviderSyncResult> {
  const providerId = resolvePrimaryDataProviderId();
  const provider = providers[providerId];

  if (!provider) {
    return {
      ok: false,
      providerId,
      providerName: providerId,
      matchesLoaded: 0,
      message: `Data provider '${providerId}' is not registered.`,
      errorCode: "provider_not_found",
    };
  }

  return provider.sync();
}

export async function syncFromProvider(providerId: string): Promise<DataProviderSyncResult> {
  const normalized = providerId.trim().toLowerCase();
  const provider = providers[normalized];

  if (!provider) {
    return {
      ok: false,
      providerId: normalized,
      providerName: normalized,
      matchesLoaded: 0,
      message: `Data provider '${normalized}' is not registered.`,
      errorCode: "provider_not_found",
    };
  }

  return provider.sync();
}
