/**
 * La base guarda 6 decimales (unos 10 cm). Google Maps copia 7 o más, así que
 * se redondea en lugar de rechazar. Acepta también el número como texto.
 * Se usa con `@Transform`.
 */
export const toCoordinate = ({ value }: { value: unknown }): unknown => {
  const number =
    typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number)
    ? Math.round(number * 1e6) / 1e6
    : value;
};
