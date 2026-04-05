export interface CampaignLaunchEntry {
  campaignId: string;
  index: number;
  ok: boolean;
  error?: string;
}

export interface BulkLaunchResult {
  total: number;
  succeeded: number;
  failed: number;
  aborted: boolean;
  entries: CampaignLaunchEntry[];
}

type LaunchFn = (campaignId: string) => Promise<{ ok: boolean; error?: string }>;

export interface BulkPublishOrchestratorOptions {
  launchFn: LaunchFn;
  delayMs?: number;
  abortOnError?: boolean;
  onLaunched?: (entry: CampaignLaunchEntry) => void;
  /** @internal test helper — injectable delay function */
  _delayFn?: (ms: number) => Promise<void>;
}

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class BulkPublishOrchestrator {
  private readonly launchFn: LaunchFn;
  private readonly delayMs: number;
  private readonly abortOnError: boolean;
  private readonly onLaunched?: (entry: CampaignLaunchEntry) => void;
  private readonly delayFn: (ms: number) => Promise<void>;

  constructor(options: BulkPublishOrchestratorOptions) {
    this.launchFn = options.launchFn;
    this.delayMs = options.delayMs ?? 0;
    this.abortOnError = options.abortOnError ?? false;
    this.onLaunched = options.onLaunched;
    this.delayFn = options._delayFn ?? defaultDelay;
  }

  async launchAll(campaignIds: string[]): Promise<BulkLaunchResult> {
    const result: BulkLaunchResult = {
      total: campaignIds.length,
      succeeded: 0,
      failed: 0,
      aborted: false,
      entries: [],
    };

    for (let i = 0; i < campaignIds.length; i++) {
      const campaignId = campaignIds[i];
      let entry: CampaignLaunchEntry;

      try {
        const launchResult = await this.launchFn(campaignId);
        if (launchResult.ok) {
          entry = { campaignId, index: i, ok: true };
          result.succeeded++;
        } else {
          entry = { campaignId, index: i, ok: false, error: launchResult.error };
          result.failed++;
        }
      } catch (err) {
        entry = {
          campaignId,
          index: i,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
        result.failed++;
      }

      result.entries.push(entry);
      this.onLaunched?.(entry);

      if (!entry.ok && this.abortOnError) {
        result.aborted = true;
        break;
      }

      // Rate limit delay between campaigns (not after the last one)
      if (this.delayMs > 0 && i < campaignIds.length - 1) {
        await this.delayFn(this.delayMs);
      }
    }

    return result;
  }
}
