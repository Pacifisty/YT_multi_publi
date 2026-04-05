import type { IncomingMessage, ServerResponse } from 'node:http';

export interface ErrorHandlerOptions {
  nodeEnv?: string;
}

type NextFn = () => Promise<void> | void;

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};

function getStatusText(code: number): string {
  return STATUS_TEXT[code] ?? 'Internal Server Error';
}

function isValidHttpStatus(code: number): boolean {
  return Number.isInteger(code) && code >= 400 && code <= 599;
}

export function createErrorHandler(
  options: ErrorHandlerOptions,
): (req: IncomingMessage, res: ServerResponse, next: NextFn) => Promise<void> {
  const isDev = options.nodeEnv !== 'production';

  return async (req: IncomingMessage, res: ServerResponse, next: NextFn): Promise<void> => {
    try {
      await next();
    } catch (thrown: unknown) {
      const isError = thrown instanceof Error;
      const message = isError ? thrown.message : 'An unexpected error occurred';

      let statusCode = 500;
      if (isError) {
        const anyErr = thrown as Error & { statusCode?: number; status?: number };
        const custom = anyErr.statusCode ?? anyErr.status;
        if (custom !== undefined && isValidHttpStatus(custom)) {
          statusCode = custom;
        }
      }

      const body: Record<string, unknown> = {
        error: getStatusText(statusCode),
        message,
      };

      if (isDev && isError) {
        body.stack = thrown.stack;
      }

      res.setHeader('content-type', 'application/json');
      res.writeHead(statusCode);
      res.end(JSON.stringify(body));
    }
  };
}
