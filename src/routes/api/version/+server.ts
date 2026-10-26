import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pkg from '../../../../package.json';

export const GET: RequestHandler = async () => {
  const commitSha = process.env.VITE_COMMIT_SHA || process.env.CI_COMMIT_SHA || 'development';
  const pipelineId = process.env.VITE_PIPELINE_ID || process.env.CI_PIPELINE_ID || 'local';

  return json({
    name: pkg.name,
    version: pkg.version,
    commitSha,
    pipelineId,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'production'
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN'
    }
  });
};
