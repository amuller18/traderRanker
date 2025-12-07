/**
 * Error Handling Middleware
 *
 * Centralized error handling for the Express application.
 *
 * Part of: Server Layer (Edge/Error Handling)
 */

/**
 * 404 Not Found handler
 * Catches requests to undefined routes
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found' })
}

/**
 * Global error handler
 * Catches all unhandled errors and returns a consistent response
 *
 * @param {Error} err - Error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Next middleware function
 */
export function globalErrorHandler(err, req, res, next) {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error', message: err.message })
}
