export function groundingOffset(surfaceY, boundsMinY, clearance = 0.012) {
  return surfaceY + clearance - boundsMinY;
}

export function normalizedModelScale(size, maxFootprint = 0.52, maxHeight = 0.42) {
  const footprint = Math.max(size.x, size.z, Number.EPSILON);
  const height = Math.max(size.y, Number.EPSILON);
  return Math.min(maxFootprint / footprint, maxHeight / height);
}
