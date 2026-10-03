/** Detects when the user says "menu/menú" in any supported language */
export const detectMenuIntentUtil = (message: string): boolean => {
  const n = message.toLowerCase().trim();
  return /\b(men[uú]|carta|carte|メニュー|메뉴)\b/.test(n);
};
