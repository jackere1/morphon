import type { Request, Response, NextFunction } from 'express';

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: string;
  details?: any;
  timestamp?: string;
  path?: string;
}

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler middleware
 * Catches all errors and returns consistent JSON responses
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Don't log if headers already sent
  if (res.headersSent) {
    return next(err);
  }

  // Default to 500 Internal Server Error
  let statusCode = 500;
  let message = 'Internal server error';
  let details: any = undefined;

  // Handle AppError instances
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    details = err.message;
  } else {
    // Log unexpected errors
    console.error('[Error]', err);
    message = err.message || 'Internal server error';
  }

  const response: ErrorResponse = {
    error: message,
    ...(details && { details }),
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  res.status(statusCode).json(response);
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
