import { expect, it, vi } from 'vitest';
import { reconcileNativeClose } from '$lib/utils/modalDialog';

function closed(state: { isConnected: boolean; open: boolean }) {
  const dialog = { ...state, showModal: vi.fn() };
  return { dialog, event: { currentTarget: dialog } as unknown as Event };
}

it('shows a dialog again when the browser forces it closed while its operation runs', () => {
  const { dialog, event } = closed({ isConnected: true, open: false }), onclose = vi.fn();
  reconcileNativeClose(event, true, onclose);
  expect(dialog.showModal).toHaveBeenCalledOnce();
  expect(onclose).not.toHaveBeenCalled();
});

it('reports a forced close of an idle dialog so its owner can open it again', () => {
  const { dialog, event } = closed({ isConnected: true, open: false }), onclose = vi.fn();
  reconcileNativeClose(event, false, onclose);
  expect(onclose).toHaveBeenCalledOnce();
  expect(dialog.showModal).not.toHaveBeenCalled();
});

it('ignores the close that unmounting fires and a dialog that is open again', () => {
  for (const state of [{ isConnected: false, open: false }, { isConnected: true, open: true }]) {
    const { dialog, event } = closed(state), onclose = vi.fn();
    reconcileNativeClose(event, true, onclose);
    reconcileNativeClose(event, false, onclose);
    expect(dialog.showModal).not.toHaveBeenCalled();
    expect(onclose).not.toHaveBeenCalled();
  }
});
