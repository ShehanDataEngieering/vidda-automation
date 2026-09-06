import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Express 4 doesn't forward a rejected promise from an async handler to
 * error middleware — it becomes an unhandled rejection that crashes the
 * whole process, taking down every other in-flight request. Wrap async
 * handlers with this so failures route through `next(err)` instead.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
