/**
 * Utility functions for emoji detection
 * Matches AngularJS utils.isTextSingleEmoji
 */

/**
 * Checks if text contains only a single emoji
 * Matches AngularJS utils.isTextSingleEmoji function
 */
export function isTextSingleEmoji(text: string | null | undefined): boolean {
  if (!text || text.length === 0 || text.length >= 70) {
    return false;
  }

  // Emoji ranges - matches AngularJS utils.js lines 1238-1254
  const ranges = [
    '\ud83c[\udf00-\udfff]', // U+1F300 to U+1F3FF
    '\ud83d[\udc00-\ude4f]', // U+1F400 to U+1F64F
    '\ud83d[\ude80-\udeff]', // U+1F680 to U+1F6FF
    '✈', '☺', '▪', '▫', '☑', '⭐️', '☝', '🤔', '🤖', '⚾', '🦀', '🤗', '✈︎', '✈︎', '➠', '➠', '✈︎',
    '👨‍👨‍👧‍👧', '👩‍👩‍👧', '✋', '👨‍❤️‍👨', '🇳🇿', '🇳🇴', '🇾🇹', '🇲🇼', '✊', '⚡', '⛅',
    '☔', '⭐', '☕', '✨', '⛄', '⛺', '⚽', '⛳', '⛽', '⚓', '‍❤️‍', '➢', '⛵', '⛲', '⛪',
    '⌚', '⏰', '⏳', '⌛', '☎', '✉', '✂', '✒', '✏', '⛔', '㊙', '㊗', '❇', '✳', '❎', '✅',
    '✴', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '♿', '▶', '◀', '⏩', '⏪',
    '⏫', '⏬', '➡', '⬅', '⬆', '⬇', '↗', '↘', '↙', '↖', '↕', '↔', '↪', '↩', '⤴', '⤵', 'ℹ',
    '➕', '➖', '〰', '➗', '✖', '✔', '™', '©', '®', '➰', '➿', '〽', '❗', '❓', '❕', '❔',
    '‼', '⁉', '❌', '⭕', 'Ⓜ', '⛎', '⚠', '♨', '♻', '♠', '♣', '♥', '♦', '⚪', '⚫', '⬛', '⬜',
    '◼', '◻', '◾', '◽', '☝️', '🏿', '🏾', '🏽', '🏼', '🏻', '🃏', '🀄', '🉑', '🉐', '🈴', '🈵',
    '🈲', '🈶', '🈚', '🈸', '🈺', '🈷', '🈹', '🈳', '🈂', '🈁', '🈯', '🆚', '🅰', '🅱', '🆎', '🆑',
    '🅾', '🆘', '🆔', '🅿', '🆒', '🆓', '🆕', '🆖', '🆗', '🆙', '❤️', '❤', '🤥', '🤡',
  ];

  const PATTERN = new RegExp(ranges.join('|'), 'g');
  const matches = text.match(PATTERN);
  
  if (matches && matches.length > 0) {
    // Remove all emojis from text
    let otherChars = text.replace(PATTERN, '');
    // Remove whitespace (newlines, spaces)
    otherChars = otherChars.replace(/\r?\n|\r| /g, '');
    
    const len = otherChars.length;
    let index = 0;
    let specialCharsCount = 0;
    
    // Count special characters (skin tone modifiers, zero-width joiners)
    while (index < len) {
      const charCode = otherChars.charCodeAt(index);
      // 65038 = FE0E (variation selector-15), 65039 = FE0F (variation selector-16), 8205 = 200D (zero-width joiner)
      if (charCode === 65038 || charCode === 65039 || charCode === 8205) {
        specialCharsCount++;
      }
      index++;
    }
    
    // If only special characters remain (or nothing), it's a single emoji
    if (otherChars.length === specialCharsCount) {
      return true;
    }
  }
  
  return false;
}







