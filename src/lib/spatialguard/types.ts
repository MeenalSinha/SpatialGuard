import type { DetailKind, Floor, Project, Wall, Door, Window } from '$lib/models/types';

export type InvariantStatus = 'passed' | 'failed' | 'error';
export type InvariantCategory = 'wall' | 'opening' | 'room' | 'interchange' | 'persistence';

export interface InvariantMetric {
  expected: unknown;
  actual: unknown;
  delta?: number;
  unit?: string;
  tolerance?: number;
}

export interface InvariantResult {
  invariantId: string;
  name: string;
  category: InvariantCategory;
  status: InvariantStatus;
  target: {
    floorId?: string;
    elementId?: string;
    kind?: string;
  };
  metrics: InvariantMetric;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export interface SpatialAuditReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
    errors: number;
    timestamp: string;
    durationMs: number;
  };
  results: InvariantResult[];
}
