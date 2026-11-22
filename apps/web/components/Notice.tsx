import type { Translator } from '@civora/i18n';
import { NOTICES } from '@/lib/notices';

/** The notice named in ?notice=..., from the allow-list only; announced to screen readers. */
export function Notice({ t, notice }: { t: Translator; notice?: string | string[] }) {
  const n = typeof notice === 'string' ? NOTICES[notice] : undefined;
  if (!n) return null;
  return (
    <p className={`notice notice-${n.tone}`} role={n.tone === 'danger' ? 'alert' : 'status'} data-notice={notice as string}>
      {t.t(n.key)}
    </p>
  );
}
