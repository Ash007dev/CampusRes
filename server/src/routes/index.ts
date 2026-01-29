/**
 * =============================================================================
 * Campus Resource Engine - Routes Index
 * =============================================================================
 * Central route registration
 * =============================================================================
 */

import { Router, type IRouter } from 'express';
import authRoutes from './authRoutes.js';
import bookingRoutes from './bookingRoutes.js';
import roomRoutes from './roomRoutes.js';
import waitlistRoutes from './waitlistRoutes.js';

const router: IRouter = Router();

// Mount route modules
router.use('/auth', authRoutes);
router.use('/bookings', bookingRoutes);
router.use('/rooms', roomRoutes);
router.use('/waitlist', waitlistRoutes);

// Health check endpoint
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

export default router;
