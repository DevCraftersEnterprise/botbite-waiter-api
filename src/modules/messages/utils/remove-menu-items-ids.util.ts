export const removeMenuItemsIdsUtil = (message: string): string => {
  // Elimina [ID:xxx] completos y también IDs incompletos como [ID:xxx o • [ID:xxx
  return message
    .replace(/\[ID:[^\]]+\]?\s*/g, '')
    .replace(/•\s*\[ID:[^\s\]]+/g, '•');
};
