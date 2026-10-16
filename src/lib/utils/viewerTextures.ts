import * as THREE from 'three';
import { ownTexture } from './furnitureModelResources';

/** An owned texture for a canvas of colours: CSS fills, drawn photos, label text.
 * Canvas pixels are sRGB-encoded, so the texture is tagged sRGB and three.js decodes
 * it to linear before lighting, as THREE.Color does for the same hex values. Data
 * maps (normals, roughness) must stay linear and do not belong here. */
export function ownColorCanvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = ownTexture(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
