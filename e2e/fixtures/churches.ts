export const churches = [
  { publicId: 'church-1', name: 'Igreja Batista Central', address: 'R. da Conceição, 100 - Centro, Niterói - RJ', lat: -22.894623, lon: -43.123987, distanceKm: 0.45, distanceMeters: 450 },
  { publicId: 'church-2', name: 'Igreja Presbiteriana Icaraí', address: 'R. Gavião Peixoto, 50 - Icaraí, Niterói - RJ', lat: -22.903, lon: -43.108, distanceKm: 1.42, distanceMeters: 1420 },
  { publicId: 'church-3', name: 'Comunidade Evangélica Ingá', address: null, lat: -22.9081, lon: -43.1275, distanceKm: 2.05, distanceMeters: 2050 },
  { publicId: 'church-4', name: 'Igreja Metodista São Domingos com um nome bem comprido para testar a quebra de linha', address: 'Av. Visconde do Rio Branco, 3000 Bloco B Sala 1201 - São Domingos, Niterói - RJ', lat: -22.8992, lon: -43.1301, distanceKm: 3.4, distanceMeters: 3400 },
  { publicId: 'church-5', name: 'Assembleia de Deus Fonseca', address: 'R. Desembargador Lima Castro, 200 - Fonseca, Niterói - RJ', lat: -22.8811, lon: -43.0998, distanceKm: 12.75, distanceMeters: 12750 },
]

export const nearestResponse = (list = churches) => ({
  nearestChurchesInfo: list,
  origin: { lat: -22.8968, lon: -43.1236 },
  totalFound: list.length,
  mode: 'pedestrian',
  precision: 'ROOFTOP',
  coordinatesProviderName: 'e2e',
})
