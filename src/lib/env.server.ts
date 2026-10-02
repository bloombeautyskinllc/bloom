import 'server-only';
import { z } from 'zod';

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  RESEND_API_KEY: z.string().startsWith('re_'),
  EMAIL_FROM: z.string().min(3),
  ADMIN_EMAILS: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)),
  JOBS_SECRET: z.string().min(32),
  // Google Calendar (optional until the calendar integration is used)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // Resend delivery webhooks (whsec_...), optional until the webhook is configured in Resend
  RESEND_WEBHOOK_SECRET: z.string().optional(),
});

let cached: z.infer<typeof serverEnvSchema> | undefined;

// Validated lazily so a missing secret fails the request that needs it, not the build
export function serverEnv() {
  cached ??= serverEnvSchema.parse(process.env);
  return cached;
}
