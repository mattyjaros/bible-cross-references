import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { InstallGuideDialog } from '../ui/InstallGuide.tsx';
import { VerseShareDialog } from '../../visualizations/shared/components/VerseShareDialog.tsx';
import '../styles/global.css';

/**
 * Renders a page's root component into `#root`, beside the two things every page shares that are
 * not part of any of them: the install guide, which the footers open, and the verse share dialog,
 * which a verse in either view opens. Both live out here so that a page with several views (each
 * with a footer, and each with verses of its own) still has exactly one of each.
 */
export function mount(page: ReactNode): void {
  const container = document.getElementById('root');
  if (!container) {
    throw new Error('Root element #root not found.');
  }
  createRoot(container).render(
    <StrictMode>
      {page}
      <InstallGuideDialog />
      <VerseShareDialog />
    </StrictMode>,
  );
}
