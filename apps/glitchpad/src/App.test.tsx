import { render, screen } from '@testing-library/react';

import { App } from './App';

describe('foundation shell', () => {
  it('identifies the product and foundation version', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Glitchpad' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Version 0.0.0');
  });
});
