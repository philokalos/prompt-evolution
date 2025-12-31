import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

interface ApiErrorLike extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler: ErrorRequestHandler = (
  err: ApiErrorLike,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`[API Error] ${req.method} ${req.path}:`, {
    statusCode,
    message,
    stack: err.stack,
  });

  res.status(statusCode).json({
    error: {
      message,
      code: err.code || 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};

// Helper to create API errors
export class ApiError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'ApiError';
  }

  static badRequest(message: string) {
    return new ApiError(message, 400, 'BAD_REQUEST');
  }

  static notFound(message: string) {
    return new ApiError(message, 404, 'NOT_FOUND');
  }

  static internal(message: string) {
    return new ApiError(message, 500, 'INTERNAL_ERROR');
  }
}
