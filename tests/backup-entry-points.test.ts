import { mockStorage } from './fixtures/indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Project } from '$lib/models/types';
import { prepareLibraryRestore } from '$lib/services/libraryRestore';
import { libraryBackup } from '$lib/services/localDatabase';
import { createLocalStore } from '$lib/services/datastore';
import { readProject } from '$lib/utils/projectValidation';
import { projectServiceMessage } from '$lib/i18n/projectServiceMessages';

// Both files were written by the release that was live on 2026-09-29 (d68cadf): a two-floor plan
// drawn from scratch (walls, a door, an opening, a sliding door, windows, named rooms, text
// labels, stairs up and down, a measurement and a dimension), saved with Download JSON, and then
// Download library backup after duplicating it twice (a copy and a copy of the copy).
const projectFile = readFileSync('tests/fixtures/sketch-two-floors.openplan.json', 'utf8');
const libraryFile = readFileSync('tests/fixtures/sketch-library-backup.json', 'utf8');

beforeEach(() => { mockStorage(); });

function contents(project: Project) {
  return project.floors.map(floor => ({
    name: floor.name, walls: floor.walls.length, doors: floor.doors.map(door => door.type), windows: floor.windows.length,
    rooms: floor.rooms.map(room => room.name), text: floor.textAnnotations.map(label => label.text),
    stairs: floor.stairs.map(stair => stair.direction), measurements: floor.measurements.length,
    dimensions: floor.annotations.map(dimension => dimension.label),
  }));
}

describe('Restore library backup', () => {
  it('restores one project saved with Download JSON instead of calling it a damaged library', async () => {
    const preview = prepareLibraryRestore(projectFile, 'Our house - shell(1).json');
    expect(preview.projectCount).toBe(1);
    expect(preview.entries).toEqual([{ id: 'fts6gdcm', name: 'Our house - shell', restorable: true, versions: 0, warnings: [] }]);
    expect(preview.warnings).toEqual([]);
    const { projects } = await preview.restore();
    expect(projects.map(project => project.name)).toEqual(['Our house - shell (Restored copy)']);
    const restored = (await createLocalStore().load(projects[0].id))!;
    expect(restored.id).not.toBe('fts6gdcm');
    expect(restored.floors).toEqual(readProject(JSON.parse(projectFile)).floors);
    expect(contents(restored)).toEqual([
      { name: 'Ground Floor', walls: 5, doors: ['single', 'opening', 'sliding'], windows: 3, rooms: ['Living room', 'Kitchen'],
        text: ['Check ceiling height', 'Fireplace ~ 1.5 m'], stairs: ['up'], measurements: 1, dimensions: ['approx 6 m'] },
      { name: 'Floor 1', walls: 4, doors: [], windows: 1, rooms: [], text: ['Bedroom 2'], stairs: ['down'], measurements: 0, dimensions: [] },
    ]);
  });

  it('keeps a project file it cannot open as recovery data, with the reason', async () => {
    const damaged = JSON.parse(projectFile);
    damaged.floors[0].walls[0].start = null;
    const raw = JSON.stringify(damaged);
    const preview = prepareLibraryRestore(raw, 'damaged.json');
    expect(preview.projectCount).toBe(0);
    expect(preview.entries[0]).toMatchObject({ id: 'fts6gdcm', restorable: false, warnings: ['Invalid project: floors[0].walls[0].start must be an object.'] });
    expect(preview.recoveryArchives).toBe(1);
    await preview.restore();
    const archived = Object.values(JSON.parse(await libraryBackup()).recovery).map(entry => JSON.parse(entry as string));
    expect(archived[0].projects.fts6gdcm).toBe(raw);
  });

  it.each([
    ['an iPhone or sibling-planner interchange file', { openplanPrepared: true, openplanHandoffVersion: 1, walls: [] }],
    ['a raw RoomPlan scan', { walls: [{ identifier: 'w', dimensions: [4, 2.5, 0] }] }],
  ])('points %s to Import JSON', (_kind, file) => {
    let message = '';
    try { prepareLibraryRestore(JSON.stringify(file)); } catch (error) { message = (error as Error).message; }
    expect(message).toBe('This is a RoomPlan scan or an interchange JSON file, not a backup. Open it with Import JSON in the editor. No projects were restored.');
    expect(projectServiceMessage(message, 'pt')).toBe('Este é um escaneamento RoomPlan ou um JSON de intercâmbio, não um backup. Abra-o com Importar JSON no editor. Nenhum projeto foi restaurado.');
  });

  it('still restores the September library backup with every copy, its version and the previews', async () => {
    const preview = prepareLibraryRestore(libraryFile, 'openplan3d-library-backup.json');
    expect(preview.entries.map(entry => [entry.name, entry.restorable, entry.versions]).sort((a, b) => a[0] < b[0] ? -1 : 1)).toEqual([
      ['Our house - shell', true, 1], ['Our house - shell (Copy)', true, 0], ['Our house - shell (Copy) (Copy)', true, 0],
    ]);
    const { projects } = await preview.restore(), store = createLocalStore();
    expect(projects.map(project => project.name).sort()).toEqual([
      'Our house - shell (Copy) (Copy) (Restored copy)', 'Our house - shell (Copy) (Restored copy)', 'Our house - shell (Restored copy)',
    ]);
    for (const { id } of projects) {
      const restored = (await store.load(id))!;
      expect(restored.floors).toEqual(readProject(JSON.parse(projectFile)).floors);
      expect(await store.getThumbnail(id)).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
    }
  });
});
