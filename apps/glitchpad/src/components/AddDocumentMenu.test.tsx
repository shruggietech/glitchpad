import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { AppFrame } from '../../../../brand/web/react/server';
import { AddDocumentMenu } from './AddDocumentMenu';

it('exposes distinct choices, traps focus and consumes outside dismissal', async () => {
  const created = vi.fn();
  const choose = vi.fn();
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <AppFrame>
        <AddDocumentMenu
          open={open}
          onOpenChange={setOpen}
          onNew={created}
          onChoose={choose}
          canChoose
        />
      </AppFrame>
    );
  }
  render(<Harness />);
  fireEvent.click(await screen.findByRole('button', { name: 'Add document' }));
  expect(screen.getByRole('menuitem', { name: 'New Markdown' })).toHaveFocus();
  fireEvent.click(screen.getByRole('menuitem', { name: 'New text file' }));
  expect(created).toHaveBeenCalledWith('text');
  expect(screen.getByRole('button', { name: 'Add document' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Add document' }));
  fireEvent.pointerDown(document.querySelector('.add-document-scrim')!);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(choose).not.toHaveBeenCalled();
});
