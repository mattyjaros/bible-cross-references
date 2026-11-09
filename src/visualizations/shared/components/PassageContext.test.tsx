import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { verseIndex } from '../../../test-utils/fixtures.ts';
import { createVizData } from '../../../test-utils/viz-data.ts';
import { PassageContext } from './PassageContext.tsx';

const ROM_5_8 = verseIndex('Rom', 5, 8);
const ROM_5_1 = verseIndex('Rom', 5, 1);
const GEN_1_2 = verseIndex('Gen', 1, 2);

const DATA = createVizData(
  [],
  new Map([
    [ROM_5_8, 'But God proves His love'],
    [verseIndex('Rom', 5, 3), 'Not only this'],
    [verseIndex('Rom', 4, 25), 'He was delivered over'],
    [verseIndex('Rom', 5, 13), 'For until the law'],
    [verseIndex('Rom', 5, 14), 'Nevertheless death reigned'],
    [GEN_1_2, 'The earth was formless'],
  ]),
);

function renderContext(start = ROM_5_8, end = start) {
  const onGo = vi.fn();
  const onClose = vi.fn();
  render(
    <PassageContext
      translation={DATA.translation}
      versification={DATA.versification}
      start={start}
      end={end}
      marks={(verse) => (verse === ROM_5_8 ? [{ start: 4, end: 7, text: 'God' }] : [])}
      onGo={onGo}
      onClose={onClose}
    />,
  );
  return { onGo, onClose };
}

describe('PassageContext', () => {
  it('shows the passage among the verses around it, with its shared words marked', () => {
    renderContext();
    expect(screen.getByRole('dialog', { name: 'Romans 5:8' })).toBeDefined();
    expect(screen.getByText(/proves His love/)).toBeDefined();
    expect(screen.getByText('God').tagName).toBe('MARK');
    expect(screen.getByText(/Not only this/)).toBeDefined();
    expect(screen.getByText(/For until the law/)).toBeDefined();
    expect(screen.queryByText(/He was delivered over/)).toBeNull();
    expect(screen.queryByText(/Nevertheless death reigned/)).toBeNull();
    expect(screen.getByText('Chapter 5')).toBeDefined();
  });

  it('widens in either direction, across chapters', async () => {
    renderContext();
    await userEvent.click(screen.getByRole('button', { name: 'Earlier verses' }));
    expect(screen.getByText(/He was delivered over/)).toBeDefined();
    expect(screen.getByText('Chapter 4')).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Later verses' }));
    expect(screen.getByText(/Nevertheless death reigned/)).toBeDefined();
  });

  it('stops at the edges of its book', () => {
    renderContext(GEN_1_2);
    expect(screen.getByText(/The earth was formless/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Earlier verses' })).toBeNull();
    expect(screen.getByText('Chapter 1')).toBeDefined();
  });

  it('starts a chapter heading where a chapter starts', () => {
    renderContext(ROM_5_1);
    expect(screen.getByText('Chapter 4')).toBeDefined();
    expect(screen.getByText('Chapter 5')).toBeDefined();
  });

  it('goes to the passage, or closes', async () => {
    const { onGo, onClose } = renderContext();
    await userEvent.click(screen.getByRole('button', { name: 'Go to this passage' }));
    expect(onGo).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on a tap outside it', async () => {
    const { onClose } = renderContext();
    await userEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalled();
  });
});
