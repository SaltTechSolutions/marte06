/**
 * GymEntra - Dynamic Friendly Gym Code Generator
 * Generates clean, memorable, slug-based gym codes without hardcoded prefixes.
 * Examples:
 *   "Olympus Fitness & Spa" -> "OLYMPUS-84"
 *   "Kadıköy CrossFit Studio" -> "KADIKOY-19"
 */
export function generateFriendlyGymCode(gymName: string): string {
  if (!gymName || typeof gymName !== 'string') {
    return `GYM-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const normalized = gymName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .toUpperCase();
    
  const words = normalized.split(/\s+/).filter(Boolean);
  const mainWord = words[0] || "GYM";
  const cleanWord = mainWord.substring(0, 10);
  const randomSuffix = Math.floor(10 + Math.random() * 90); // 2-digit random number (10-99)
  
  return `${cleanWord}-${randomSuffix}`;
}
