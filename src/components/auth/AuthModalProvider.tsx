'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { routes } from '@/data/site';
import { AUTH_PARAMS, safeNext, type AuthStep } from '@/lib/auth/redirect';
import { setScrollLocked } from '@/lib/smoothScroll';
import { createClient } from '@/lib/supabase/client';
import AuthModal, { type OnboardingDefaults } from './AuthModal';

// Links to these paths need a signed-in, onboarded client: clicks are intercepted and the modal opens
const PROTECTED_PREFIXES = [routes.booking, routes.dashboard];
const isProtected = (pathname: string) =>
  PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

type AuthState = { open: boolean; step: AuthStep; next: string; error: string | null; returnTo: string; defaults: OnboardingDefaults | null };

type AuthModalApi = { openAuth: (next: string) => Promise<void> };

const AuthModalContext = createContext<AuthModalApi | null>(null);

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error('useAuthModal must be used inside AuthModalProvider');
  return ctx;
}

// Current page without the modal's own query params: where Google sends the visitor back to
function currentPageWithoutAuthParams() {
  const url = new URL(window.location.href);
  AUTH_PARAMS.forEach((p) => url.searchParams.delete(p));
  return `${url.pathname}${url.search}${url.hash}`;
}

export default function AuthModalProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<AuthState>({
    open: false,
    step: 'signin',
    next: routes.dashboard,
    error: null,
    returnTo: '/',
    defaults: null,
  });

  /** Where is this visitor in the flow? Reads the local session, then their own profile (RLS). */
  const resolveStep = useCallback(async (): Promise<{ step: AuthStep | 'ready'; defaults: OnboardingDefaults | null }> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { step: 'signin', defaults: null };

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone_e164, reminders_opt_in, onboarded_at')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (!profile) return { step: 'signin', defaults: null };

    const defaults = { fullName: profile.full_name ?? '', phoneE164: profile.phone_e164, reminders: profile.reminders_opt_in };
    return { step: profile.onboarded_at ? 'ready' : 'onboarding', defaults };
  }, [supabase]);

  const open = useCallback((step: AuthStep, next: string, error: string | null, defaults: OnboardingDefaults | null) => {
    setState({ open: true, step, next, error, returnTo: currentPageWithoutAuthParams(), defaults });
  }, []);

  const openAuth = useCallback(
    async (next: string) => {
      const { step, defaults } = await resolveStep();
      if (step === 'ready') router.push(next);
      else open(step, next, null, defaults);
    },
    [open, resolveStep, router],
  );

  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
    // Drop ?auth=... so a refresh does not reopen it (Next's router integrates with replaceState)
    const url = new URL(window.location.href);
    if (AUTH_PARAMS.some((p) => url.searchParams.has(p))) {
      window.history.replaceState(window.history.state, '', currentPageWithoutAuthParams());
    }
  }, []);

  // Open from the URL (return from Google, server guards, direct visits); close after navigating on
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const step = params.get('auth');
    if (step === 'signin' || step === 'onboarding') {
      const next = safeNext(params.get('next')) ?? routes.dashboard;
      const error = params.get('auth_error');
      resolveStep().then((status) => {
        if (status.step === 'ready') {
          close();
          router.replace(next);
        } else {
          // Trust the session over the URL: a signed-in visitor never sees step 1 again
          open(status.step, next, status.step === step ? error : null, status.defaults);
        }
      });
    } else if (lastPath.current !== null && lastPath.current !== pathname) {
      setState((s) => (s.open ? { ...s, open: false } : s));
    }
    lastPath.current = pathname;
  }, [pathname, resolveStep, open, close, router]);

  // Intercept clicks on links to protected pages anywhere on the site ("Book now", cards, footer...)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest('a');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || !isProtected(url.pathname)) return;

      // Handled before Next's router sees it; we navigate ourselves once the visitor is ready
      e.preventDefault();
      e.stopPropagation();
      void openAuth(`${url.pathname}${url.search}`);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [openAuth]);

  useEffect(() => {
    setScrollLocked(state.open);
    return () => setScrollLocked(false);
  }, [state.open]);

  const api = useMemo(() => ({ openAuth }), [openAuth]);

  return (
    <AuthModalContext.Provider value={api}>
      {children}
      <AuthModal
        open={state.open}
        step={state.step}
        next={state.next}
        error={state.error}
        returnTo={state.returnTo}
        defaults={state.defaults}
        onClose={close}
      />
    </AuthModalContext.Provider>
  );
}
