import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { appendRecoveryHelp } from './recovery-help';
it('keeps installed information, full offline notices and explicit destinations available without the app tree', async () => {
  const root = document.createElement('main');
  document.body.append(root);
  const info = vi.fn().mockResolvedValue({
    package_identifier: 'actual.installed',
    version: '1.2',
    version_code: 12,
    channel: 'debug',
    platform: 'android',
    build_commit: 'compiled-source',
  });
  const notices = vi.fn().mockResolvedValue('complete offline license text');
  const open = vi.fn().mockResolvedValue(undefined);
  const dispose = appendRecoveryHelp(root, { info, notices }, { open });
  expect(info).not.toHaveBeenCalled();
  expect(notices).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Help and About' }));
  expect(await screen.findByText('actual.installed')).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Offline licenses and notices' }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText('Offline license notices')).toHaveTextContent(
      'complete offline license text',
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Report an issue' }));
  await waitFor(() =>
    expect(open).toHaveBeenCalledExactlyOnceWith(
      'https://github.com/ShruggieTech/glitchpad/issues/new/choose',
    ),
  );
  dispose();
  root.remove();
});
