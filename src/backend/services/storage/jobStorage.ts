import { getDatabase } from '../../database/client.js';
import type { Database } from 'better-sqlite3';

export interface Job {
  id: string;
  status: 'queued' | 'rendering' | 'done' | 'error';
  progress: number;
  title?: string;
  topic?: string;
  manifest: any;  // ShowManifest object
  outputPath?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

interface JobRow {
  id: string;
  status: string;
  progress: number;
  title: string | null;
  topic: string | null;
  manifest: string;  // JSON string
  output_path: string | null;
  error: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

/**
 * Convert database row to Job object
 */
function rowToJob(row: JobRow): Job {
  return {
    id: row.id,
    status: row.status as Job['status'],
    progress: row.progress,
    title: row.title || undefined,
    topic: row.topic || undefined,
    manifest: JSON.parse(row.manifest),
    outputPath: row.output_path || undefined,
    error: row.error || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at || undefined,
  };
}

/**
 * Create a new job in the database
 */
export function createJob(job: Job): Job {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO jobs (
      id, status, progress, title, topic, manifest,
      output_path, error, created_at, updated_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    job.id,
    job.status,
    job.progress,
    job.title || null,
    job.topic || null,
    JSON.stringify(job.manifest),
    job.outputPath || null,
    job.error || null,
    job.createdAt,
    job.updatedAt,
    job.completedAt || null
  );

  return job;
}

/**
 * Get a job by ID
 */
export function getJob(id: string): Job | null {
  const db = getDatabase();

  const stmt = db.prepare('SELECT * FROM jobs WHERE id = ?');
  const row = stmt.get(id) as JobRow | undefined;

  return row ? rowToJob(row) : null;
}

/**
 * Update a job
 */
export function updateJob(id: string, updates: Partial<Job>): Job | null {
  const db = getDatabase();

  // Build dynamic UPDATE query
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.progress !== undefined) {
    fields.push('progress = ?');
    values.push(updates.progress);
  }
  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.topic !== undefined) {
    fields.push('topic = ?');
    values.push(updates.topic);
  }
  if (updates.manifest !== undefined) {
    fields.push('manifest = ?');
    values.push(JSON.stringify(updates.manifest));
  }
  if (updates.outputPath !== undefined) {
    fields.push('output_path = ?');
    values.push(updates.outputPath);
  }
  if (updates.error !== undefined) {
    fields.push('error = ?');
    values.push(updates.error);
  }
  if (updates.completedAt !== undefined) {
    fields.push('completed_at = ?');
    values.push(updates.completedAt);
  }

  // Always update updated_at
  fields.push('updated_at = ?');
  values.push(Date.now());

  if (fields.length === 0) {
    return getJob(id);
  }

  values.push(id);

  const stmt = db.prepare(`
    UPDATE jobs
    SET ${fields.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...values);

  return getJob(id);
}

/**
 * List jobs with optional filtering and pagination
 */
export function listJobs(options?: {
  status?: Job['status'];
  limit?: number;
  offset?: number;
}): Job[] {
  const db = getDatabase();

  let query = 'SELECT * FROM jobs';
  const params: any[] = [];

  if (options?.status) {
    query += ' WHERE status = ?';
    params.push(options.status);
  }

  query += ' ORDER BY created_at DESC';

  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);

    if (options?.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }
  }

  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as JobRow[];

  return rows.map(rowToJob);
}

/**
 * Delete a job by ID
 */
export function deleteJob(id: string): boolean {
  const db = getDatabase();

  const stmt = db.prepare('DELETE FROM jobs WHERE id = ?');
  const result = stmt.run(id);

  return result.changes > 0;
}

/**
 * Count jobs by status
 */
export function countJobs(status?: Job['status']): number {
  const db = getDatabase();

  let query = 'SELECT COUNT(*) as count FROM jobs';
  const params: any[] = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  const stmt = db.prepare(query);
  const result = stmt.get(...params) as { count: number };

  return result.count;
}

/**
 * Delete jobs older than retention period
 */
export function deleteOldJobs(retentionDays: number = 7): number {
  const db = getDatabase();
  const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

  const stmt = db.prepare(`
    DELETE FROM jobs
    WHERE created_at < ? AND status IN ('done', 'error')
  `);

  const result = stmt.run(cutoffTime);
  return result.changes;
}
