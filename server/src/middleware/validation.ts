/**
 * =============================================================================
 * Campus Resource Engine - Zod Validation Middleware
 * =============================================================================
 * Express middleware for request validation using Zod schemas
 * 
 * PATTERN: Validates body, query, or params before reaching controller
 * - Fail Fast: Invalid requests are rejected immediately
 * - Type Safety: Controllers receive validated, typed data
 * - Consistent Errors: All validation errors follow same format
 * =============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';
import { logger } from '../config/logger.js';

/**
 * Request parts that can be validated
 */
type ValidatableProperty = 'body' | 'query' | 'params';

/**
 * Format Zod errors into a user-friendly structure
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'root';
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }

  return formatted;
}

/**
 * Create validation middleware for a specific request property
 * 
 * @param schema - Zod schema to validate against
 * @param property - Request property to validate ('body', 'query', 'params')
 * @returns Express middleware function
 * 
 * @example
 * router.post('/bookings', validate(createBookingSchema, 'body'), bookingController.create);
 */
export function validate<T>(
  schema: ZodSchema<T>,
  property: ValidatableProperty = 'body'
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // Parse and validate the request data
      const validated = await schema.parseAsync(req[property]);

      // Replace the request property with validated data
      // This ensures controllers receive transformed/defaulted values
      req[property] = validated as typeof req[typeof property];

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = formatZodErrors(error);

        logger.debug({
          property,
          errors: formattedErrors,
          received: req[property],
        }, 'Validation failed');

        next(new ValidationError('Validation failed', formattedErrors));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Validate multiple parts of the request at once
 * 
 * @param schemas - Object mapping request properties to their schemas
 * @returns Express middleware function
 * 
 * @example
 * router.get('/rooms/:id/availability',
 *   validateMultiple({
 *     params: idParamsSchema,
 *     query: availabilityQuerySchema
 *   }),
 *   roomController.getAvailability
 * );
 */
export function validateMultiple(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const errors: Record<string, Record<string, string[]>> = {};

    for (const [property, schema] of Object.entries(schemas)) {
      if (!schema) continue;

      try {
        const validated = await schema.parseAsync(req[property as ValidatableProperty]);
        req[property as ValidatableProperty] = validated;
      } catch (error) {
        if (error instanceof ZodError) {
          errors[property] = formatZodErrors(error);
        } else {
          next(error);
          return;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      next(new ValidationError('Validation failed', errors));
      return;
    }

    next();
  };
}

/**
 * Common parameter schemas
 */
import { z } from 'zod';

export const idParamsSchema = z.object({
  id: z.string().min(1),
});

export const roomIdParamsSchema = z.object({
  roomId: z.string().min(1),
});

export const bookingIdParamsSchema = z.object({
  bookingId: z.string().min(1),
});
