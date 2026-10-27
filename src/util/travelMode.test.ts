import { describe, expect, it } from 'vitest'
import { DEFAULT_TRAVEL_MODE, TRAVEL_MODES, isTravelMode } from './travelMode'

describe('travel modes', () => {
  it('walks by default, as the backend does', () => {
    expect(DEFAULT_TRAVEL_MODE).toBe('pedestrian')
  })

  it('uses the approved copy and Google Maps travel modes', () => {
    expect(TRAVEL_MODES).toEqual({
      pedestrian: { option: 'A pé', distanceSuffix: 'a pé', googleTravelMode: 'walking' },
      transport: { option: 'Por transporte', distanceSuffix: 'por transporte', googleTravelMode: 'driving' },
    })
  })

  it.each([
    ['pedestrian', true],
    ['transport', true],
    ['bicycle', false],
    ['', false],
    [undefined, false],
    [null, false],
  ])('isTravelMode(%j) is %s', (value, expected) => {
    expect(isTravelMode(value)).toBe(expected)
  })
})
