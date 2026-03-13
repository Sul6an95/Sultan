import { syncFromPandaScore } from "../pandascore";
import { storage } from "../storage";
import type { DataProvider, DataProviderSyncResult } from "./types";

const PROVIDER_ID = "pandascore";
const PROVIDER_NAME = "PandaScore";

function isPandaScoreConfigured(): boolean {
  return Boolean(process.env.PANDASCORE_API_KEY);
}

export const pandaScoreProvider: DataProvider = {
  id: PROVIDER_ID,
  name: PROVIDER_NAME,

  isConfigured(): boolean {
    return isPandaScoreConfigured();
  },

  async sync(): Promise<DataProviderSyncResult> {
    if (!isPandaScoreConfigured()) {
      return {
        ok: false,
        providerId: PROVIDER_ID,
        providerName: PROVIDER_NAME,
        matchesLoaded: 0,
        message: "PANDASCORE_API_KEY is missing. Configure provider credentials before sync.",
        errorCode: "not_configured",
      };
    }

    const ok = await syncFromPandaScore();

    if (!ok) {
      return {
        ok: false,
        providerId: PROVIDER_ID,
        providerName: PROVIDER_NAME,
        matchesLoaded: 0,
        message: "PandaScore sync failed.",
        errorCode: "sync_failed",
      };
    }

    const matchesLoaded = (await storage.getMatches()).length;

    return {
      ok: true,
      providerId: PROVIDER_ID,
      providerName: PROVIDER_NAME,
      matchesLoaded,
      message: `Synced successfully from ${PROVIDER_NAME}.`,
    };
  },
};
