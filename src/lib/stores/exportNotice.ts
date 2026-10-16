import { writable } from 'svelte/store';
import type { TranslationKey } from '$lib/i18n';
import type { Project } from '$lib/models/types';
import { exportAsPNG, exportPDF } from '$lib/utils/export';
import { interchangeFileName, projectToPreparedRoomPlan, sortedJson } from '$lib/utils/interchange';
import { TransferLinkError, siblingImportUrl, type SiblingPlannerId } from '$lib/utils/transferLink';

/** The published user guide, linked from the editor, its shortcuts dialog and the library. */
export const USER_GUIDE_URL = 'https://github.com/laanlabs/openPlan3D/blob/main/docs/user-guide.md';

export const exportNotice = writable<{ title: TranslationKey; message: TranslationKey } | null>(null);

/** Both PDF entry points use the same outcome reporting. */
export async function exportPDFWithFeedback(project: Project) {
  exportNotice.set(null);
  try {
    const result = await exportPDF(project);
    if (!result) {
      exportNotice.set({ title: 'exportNotice.pdfTitle', message: 'exportNotice.pdfEmpty' });
    } else if (result.omitted3D) {
      exportNotice.set({ title: 'exportNotice.pdfPartial', message: 'exportNotice.pdfPartialHelp' });
    }
  } catch {
    exportNotice.set({ title: 'exportNotice.pdfTitle', message: 'exportNotice.pdfFailed' });
  }
}

export async function exportPNGWithFeedback(project: Project) {
  exportNotice.set(null);
  try {
    if (!await exportAsPNG(null, project)) exportNotice.set({ title: 'exportNotice.pngTitle', message: 'exportNotice.pngEmpty' });
  } catch {
    exportNotice.set({ title: 'exportNotice.pngTitle', message: 'exportNotice.pngFailed' });
  }
}

/** Save the plan as prepared RoomPlan JSON, the file the sibling planners and the iPhone app import. */
export function downloadInterchangeJson(project: Project) {
  const blob = new Blob([sortedJson(projectToPreparedRoomPlan(project), 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url; link.download = interchangeFileName(project); link.click();
  } finally { URL.revokeObjectURL(url); }
}

/** What openInSiblingPlanner needs from the tab it opens; `window.open`'s result satisfies it. */
export type PlannerTab = { opener: unknown; location: { replace(url: string): void }; close(): void } | null;

/**
 * Open the plan in a sibling planner. The tab opens synchronously, while the click is still
 * trusted, and gets the transfer link once it is built (deflate is asynchronous); a plan too
 * large for a link is downloaded as interchange JSON instead. Resolves true when the planner
 * was opened; every failure is reported through exportNotice.
 */
export async function openInSiblingPlanner(project: Project, id: SiblingPlannerId,
  open: (url: string, target: string) => PlannerTab = (url, target) => window.open(url, target),
  download: (project: Project) => void = downloadInterchangeJson): Promise<boolean> {
  exportNotice.set(null);
  const tab = open('about:blank', '_blank');
  if (!tab) { exportNotice.set({ title: 'exportNotice.linkTitle', message: 'exportNotice.linkBlocked' }); return false; }
  try {
    const url = await siblingImportUrl(id, projectToPreparedRoomPlan(project, { forLink: true }));
    tab.opener = null;
    tab.location.replace(url);
    return true;
  } catch (error) {
    tab.close();
    const reason = error instanceof TransferLinkError ? error.reason : null;
    if (reason === 'too-large') download(project);
    exportNotice.set({ title: 'exportNotice.linkTitle', message: reason === 'too-large' ? 'exportNotice.linkTooLarge' : reason === 'unsupported' ? 'exportNotice.linkUnsupported' : 'exportNotice.linkFailed' });
    return false;
  }
}
