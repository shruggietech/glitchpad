import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';

import { DiagramViewport } from './DiagramViewport';
import { rendererResourceLedger } from '../domain/resource-ledger';

const setViewportDimensions = (contentWidth = 4_096, contentHeight = 4_096, viewportWidth = 1_024, viewportHeight = 1_024) => {
  const image = screen.getByRole('img');
  const canvas = screen.getByRole('group');
  Object.defineProperties(image, {
    naturalWidth: { configurable: true, value: contentWidth },
    naturalHeight: { configurable: true, value: contentHeight },
  });
  Object.defineProperties(canvas, {
    clientWidth: { configurable: true, value: viewportWidth },
    clientHeight: { configurable: true, value: viewportHeight },
  });
  fireEvent.load(image);
};

describe('DiagramViewport', () => {
  it('preserves and then disposes its resource owner through StrictMode replay', async () => {
    const view = render(
      <StrictMode>
        <DiagramViewport svg='<svg xmlns="http://www.w3.org/2000/svg"/>' label="Strict viewport" description={null} />
      </StrictMode>,
    );
    expect(rendererResourceLedger.snapshots().some(({ owner_id }) => owner_id.startsWith('viewport:'))).toBe(true);
    view.unmount();
    await waitFor(() => {
      expect(rendererResourceLedger.snapshots().some(({ owner_id }) => owner_id.startsWith('viewport:'))).toBe(false);
    });
  });

  it('provides fit, actual, zoom, and keyboard pan controls', () => {
    render(<DiagramViewport svg='<svg xmlns="http://www.w3.org/2000/svg"/>' label="Architecture" description="System flow" />);
    expect(screen.getByRole('img', { name: 'Architecture' })).toBeInTheDocument();
    setViewportDimensions();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('125%')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowRight' });
    expect(screen.getByRole('img')).toHaveStyle({ transform: 'translate(48px, 0px) scale(1.25)' });
    fireEvent.pointerDown(screen.getByRole('group'), { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(screen.getByRole('group'), { pointerId: 1, clientX: 30, clientY: 40 });
    fireEvent.pointerUp(screen.getByRole('group'), { pointerId: 1 });
    expect(screen.getByRole('img')).toHaveStyle({ transform: 'translate(68px, 30px) scale(1.25)' });
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('bounds zoom and supports touch-style pointer navigation', () => {
    render(<DiagramViewport svg='<svg xmlns="http://www.w3.org/2000/svg"/>' label="Architecture" description={null} />);
    const canvas = screen.getByRole('group');
    expect(screen.getByRole('img')).toHaveClass('diagram-image-fit');
    setViewportDimensions(20_000, 20_000);
    for (let index = 0; index < 20; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('800%')).toBeInTheDocument();
    for (let index = 0; index < 40; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(screen.getByText('10%')).toBeInTheDocument();
    fireEvent.pointerDown(canvas, { pointerId: 9, pointerType: 'touch', clientX: 4, clientY: 8 });
    fireEvent.pointerMove(canvas, { pointerId: 9, pointerType: 'touch', clientX: 14, clientY: 28 });
    fireEvent.pointerUp(canvas, { pointerId: 9, pointerType: 'touch' });
    expect(screen.getByRole('img')).toHaveStyle({ transform: 'translate(10px, 20px) scale(0.1)' });
    fireEvent.click(screen.getByRole('button', { name: 'Actual size' }));
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveClass('diagram-image-actual');
  });

  it('derives pan bounds from the rendered image, viewport, and zoom', () => {
    render(<DiagramViewport svg='<svg xmlns="http://www.w3.org/2000/svg"/>' label="Wide diagram" description={null} />);
    setViewportDimensions(10_000, 2_000, 1_024, 768);
    const canvas = screen.getByRole('group');
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 8_000, clientY: 8_000 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    expect(screen.getByRole('img')).toHaveStyle({ transform: 'translate(4488px, 616px) scale(1)' });
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: -20_000, clientY: -20_000 });
    fireEvent.pointerUp(canvas, { pointerId: 2 });
    expect(screen.getByRole('img')).toHaveStyle({ transform: 'translate(-5738px, -866px) scale(1.25)' });
  });
});
