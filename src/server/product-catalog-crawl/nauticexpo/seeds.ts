import { NAUTICEXPO_ORIGIN } from './constants'

/** Equipment / parts category roots (excludes boats, hulls, and shipbuilding). */
export const EQUIPMENT_CATEGORY_SEEDS = [
  `${NAUTICEXPO_ORIGIN}/cat/water-electricity-IB.html`,
  `${NAUTICEXPO_ORIGIN}/cat/navigation-radars-automatic-identification-ais-RJ.html`,
  `${NAUTICEXPO_ORIGIN}/cat/on-board-electronics-communication-KA.html`,
  `${NAUTICEXPO_ORIGIN}/cat/deck-equipment-accessories-MD.html`,
  `${NAUTICEXPO_ORIGIN}/cat/anchoring-mooring-AC.html`,
  `${NAUTICEXPO_ORIGIN}/cat/safety-equipment-IJ.html`,
  `${NAUTICEXPO_ORIGIN}/cat/plumbing-IB-1003.html`,
  `${NAUTICEXPO_ORIGIN}/cat/marine-batteries-IB-805.html`,
] as const
