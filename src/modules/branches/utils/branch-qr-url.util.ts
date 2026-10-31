/** URL fija que abre el QR impreso: `<sitio>/m/<slug de la sucursal>`. */
export const buildBranchQrUrl = (baseUrl: string, slug: string): string =>
  `${baseUrl.replace(/\/+$/, '')}/m/${slug}`;
