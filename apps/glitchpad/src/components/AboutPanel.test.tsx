import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AboutPanel } from './AboutPanel';
it('shows native facts, loads complete offline notices only on request and opens only the chosen destination', async () => {
  const gateway = {
    info: vi.fn().mockResolvedValue({
      package_identifier: 'installed.app',
      version: '8.1',
      version_code: 81,
      channel: 'debug',
      platform: 'android',
      build_commit: 'native123',
    }),
    notices: vi.fn().mockResolvedValue('FULL OFFLINE NOTICE\nend'),
  };
  const external = { open: vi.fn().mockResolvedValue(undefined) };
  render(<AboutPanel gateway={gateway} external={external} />);
  expect(await screen.findByText('installed.app')).toBeInTheDocument();
  expect(screen.getByText('native123')).toBeInTheDocument();
  expect(gateway.notices).not.toHaveBeenCalled();
  expect(external.open).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Offline licenses and notices' }),
  );
  expect(
    await screen.findByLabelText('Offline license notices'),
  ).toHaveTextContent('FULL OFFLINE NOTICE end');
  fireEvent.click(
    screen.getByRole('button', { name: 'Official documentation' }),
  );
  expect(external.open).toHaveBeenCalledExactlyOnceWith(
    'https://glitchpad.com/docs',
  );
});
it('reports actual link and notice failures without inventing a completion', async () => {
  render(
    <AboutPanel
      gateway={{
        info: () => Promise.reject(new Error()),
        notices: () => Promise.reject(new Error()),
      }}
      external={{ open: () => Promise.reject(new Error()) }}
    />,
  );
  expect(
    await screen.findByText(
      'Installed application information is unavailable.',
    ),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'GitHub repository' }));
  expect(
    await screen.findByText(/destination could not be opened/),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Offline licenses and notices' }),
  );
  expect(
    await screen.findByText(/notices could not be loaded/),
  ).toBeInTheDocument();
});
