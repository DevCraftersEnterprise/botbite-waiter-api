const DEFAULT_FRONTEND_URL = 'https://app.botbite.com.mx';

export const convertToInlineUrl = (
  url: string,
  menuId: string,
  menuName: string,
): string => {
  if (!url) return '—';

  const frontendUrl = (
    process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL
  ).replace(/\/+$/, '');

  return `${frontendUrl}/menu/${menuId}?url=${encodeURIComponent(url)}&name=${encodeURIComponent(menuName)}`;
};
