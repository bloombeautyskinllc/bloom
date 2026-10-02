import type { Tables } from '@/lib/supabase/database.types';

export type Job = Tables<'jobs'>;
export type JobHandler = (job: Job) => Promise<void>;
