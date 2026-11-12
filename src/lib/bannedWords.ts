// Single source of truth for items that must not be sold on GoCart.
// Keep this list concise — it's checked on every item save.
export const BANNED_WORDS = [
  // Alcohol
  'alcohol', 'beer', 'wine', 'spirits', 'whiskey', 'whisky', 'vodka', 'gin',
  'rum', 'brandy', 'liquor', 'champagne', 'stout', 'lager',
  // Tobacco
  'tobacco', 'cigarette', 'cigar', 'shisha', 'nicotine',
  // Controlled drugs
  'codeine', 'tramadol', 'diazepam', 'morphine', 'heroin', 'cocaine',
  'methamphetamine', 'opioid', 'fentanyl',
  // Prescription-only framing
  'prescription only', 'rx only',
  // Recreational
  'weed', 'cannabis', 'marijuana', 'hemp flower', 'psychedelic',
]

/** Returns the first matched word, or null if the text is clean. */
export function findBannedWord(text: string): string | null {
  const lower = text.toLowerCase()
  for (const word of BANNED_WORDS) {
    if (lower.includes(word)) return word
  }
  return null
}
