export interface RetryPolicyOptions {
  maxRetries: number;
  baseDelayMs: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error) => void;
  _delayFn?: (ms: number) => Promise<void>;
}

export interface RetryResult<T> {
  success: boolean;
  result: T | null;
  attempts: number;
  errors: Error[];
}

export class RetryPolicy {
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly backoffMultiplier: number;
  private readonly onRetry?: (attempt: number, error: Error) => void;
  private readonly delayFn: (ms: number) => Promise<void>;

  constructor(options: RetryPolicyOptions) {
    this.maxRetries = options.maxRetries;
    this.baseDelayMs = options.baseDelayMs;
    this.backoffMultiplier = options.backoffMultiplier ?? 2;
    this.onRetry = options.onRetry;
    this.delayFn =
      options._delayFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async execute<T>(fn: () => Promise<T> | T): Promise<RetryResult<T>> {
    const errors: Error[] = [];
    const totalAttempts = 1 + this.maxRetries;

    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
      try {
        const result = await fn();
        return { success: true, result, attempts: attempt, errors };
      } catch (thrown: unknown) {
        const error =
          thrown instanceof Error ? thrown : new Error(String(thrown));
        errors.push(error);

        if (attempt < totalAttempts) {
          const delayMs =
            this.baseDelayMs * Math.pow(this.backoffMultiplier, attempt - 1);
          await this.delayFn(delayMs);
          this.onRetry?.(attempt + 1, error);
        }
      }
    }

    return { success: false, result: null, attempts: totalAttempts, errors };
  }
}
