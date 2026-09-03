import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DiagramViewport } from './DiagramViewport';

describe('DiagramViewport', () => {
  it('provides fit, actual, zoom, and keyboard pan controls', () => {
    render(<DiagramViewport svg='<svg xmlns="http://www.w3.org/2000/svg"/>' label="Architecture" description="System flow" />);
    expect(screen.getByRole('img', { name: 'Architecture' })).toBeInTheDocument();
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
});
