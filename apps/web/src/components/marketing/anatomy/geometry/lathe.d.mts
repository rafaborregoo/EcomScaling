import type { Point3, Projection, SolidPaths } from "../iso-kit";

export function sphereOf(centre: Point3, r: number, P: Projection, options?: { steps?: number }): SolidPaths;
