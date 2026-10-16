import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ownColorCanvasTexture } from '$lib/utils/viewerTextures';
import { disposeModel } from '$lib/utils/furnitureModelResources';

// Any canvas image source will do; three.js reads it only when uploading.
const canvas = () => ({ width: 256, height: 64 }) as unknown as HTMLCanvasElement;

it('tags colour canvases sRGB, unlike three.js\'s default for canvas textures', () => {
  const source = canvas(), texture = ownColorCanvasTexture(source);
  expect(new THREE.CanvasTexture(source).colorSpace).toBe(THREE.NoColorSpace);
  expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
  expect(THREE.ColorManagement.getTransfer(texture.colorSpace)).toBe(THREE.SRGBTransfer);
  expect(texture.image).toBe(source);
  expect(texture.version).toBeGreaterThan(0); // uploaded on first use
});

it('decodes a canvas pixel to the same linear colour THREE.Color gives its hex', () => {
  // How the renderer reads the hardwood floor's #c4a882 from a tagged and an untagged canvas.
  const texel = (colorSpace: string) => new THREE.Color().setRGB(0xc4 / 255, 0xa8 / 255, 0x82 / 255, colorSpace as THREE.ColorSpace);
  const swatch = new THREE.Color('#c4a882'), tagged = texel(ownColorCanvasTexture(canvas()).colorSpace);
  for (const channel of ['r', 'g', 'b'] as const) expect(tagged[channel]).toBeCloseTo(swatch[channel], 10);
  const untagged = texel(new THREE.CanvasTexture(canvas()).colorSpace);
  expect(untagged.r).toBeGreaterThan(swatch.r * 1.3); // lit as if already linear: washed out
});

it('stays owned by the scene, so disposal releases the texture but keeps the canvas', () => {
  const source = canvas(), texture = ownColorCanvasTexture(source);
  const disposed = vi.spyOn(texture, 'dispose');
  const scene = new THREE.Group();
  scene.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: texture })));
  disposeModel(scene); disposeModel(scene);
  expect(disposed).toHaveBeenCalledTimes(1);
  expect(texture.image).toBe(source);
});
