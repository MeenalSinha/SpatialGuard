import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pkg from '../../../package.json';

export const GET: RequestHandler = async () => {
  return json({
    status: 'HEALTHY',
    timestamp: new Date().toISOString(),
    service: 'SpatialGuard / OpenPlan3D',
    version: pkg.version,
    uptime: process.uptime()
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN'
    }
  });
};
