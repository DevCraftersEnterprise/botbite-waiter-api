export const validateQrScanUtil = (
  message: string,
): { isValidQrScan: boolean; token: string | null } => {
  const trimmedMessage = message.trim();

  const tokenMatch = trimmedMessage.match(/QR-\d+-[a-f0-9]+/);

  if (!tokenMatch) {
    return { isValidQrScan: false, token: null };
  }

  if (!trimmedMessage.includes('INICIO')) {
    return { isValidQrScan: false, token: null };
  }

  return { isValidQrScan: true, token: tokenMatch[0] };
};
