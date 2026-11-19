/**
 * Shim de types pour `three`.
 *
 * `three` ne livre pas ses types et `@types/three` n'est pas installé.
 * Seul `src/components/Lanyard.tsx` — du code tiers copié depuis React
 * Bits, que nous ne modifions pas — importe cette bibliothèque.
 *
 * Chaque membre est déclaré comme une classe permissive : une classe
 * fournit à la fois une valeur et un type, ce qui couvre les deux usages
 * du fichier (`new THREE.Vector3()` et `: THREE.Vector3`).
 *
 * Ceci ne change rien à l'exécution. Pour une vraie autocomplétion :
 * `npm i -D @types/three`, puis supprimer ce fichier.
 */
declare module "three" {
  class Permissif {
    constructor(...args: unknown[]);
    [membre: string]: unknown;
  }

  export class BufferAttribute extends Permissif {}
  export class BufferGeometry extends Permissif {}
  export class CanvasTexture extends Permissif {}
  export class CatmullRomCurve3 extends Permissif {}
  export class ClampToEdgeWrapping extends Permissif {}
  export class Color extends Permissif {}
  export class DataTexture extends Permissif {}
  export class DirectionalLight extends Permissif {}
  export class DoubleSide extends Permissif {}
  export class ExtrudeGeometry extends Permissif {}
  export class Group extends Permissif {}
  export class LinearFilter extends Permissif {}
  export class LinearMipmapLinearFilter extends Permissif {}
  export class Material extends Permissif {}
  export class Matrix4 extends Permissif {}
  export class Mesh extends Permissif {}
  export class MeshBasicMaterial extends Permissif {}
  export class MeshPhysicalMaterial extends Permissif {}
  export class MeshStandardMaterial extends Permissif {}
  export class NeutralToneMapping extends Permissif {}
  export class Path extends Permissif {}
  export class PerspectiveCamera extends Permissif {}
  export class PlaneGeometry extends Permissif {}
  export class PMREMGenerator extends Permissif {}
  export class Quaternion extends Permissif {}
  export class Raycaster extends Permissif {}
  export class RepeatWrapping extends Permissif {}
  export class Scene extends Permissif {}
  export class Shape extends Permissif {}
  export class ShapeGeometry extends Permissif {}
  export class SRGBColorSpace extends Permissif {}
  export class TorusGeometry extends Permissif {}
  export class Vector2 extends Permissif {}
  export class Vector3 extends Permissif {}
  export class WebGLProgramParametersWithUniforms extends Permissif {}
  export class WebGLRenderer extends Permissif {}
}
