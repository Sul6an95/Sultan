export interface DataProviderSyncResult {
  ok: boolean;
  providerId: string;
  providerName: string;
  matchesLoaded: number;
  message: string;
  errorCode?: "not_configured" | "sync_failed" | "provider_not_found";
}

export interface DataProvider {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  sync(): Promise<DataProviderSyncResult>;
}
