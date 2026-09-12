// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { AssetBrandLogo } from './AssetBrandLogo'

afterEach(cleanup)

it('shows an accessible local logo and falls back when it fails to load', () => {
  const { rerender } = render(<AssetBrandLogo brand="Quark Elec" />)
  expect(
    screen.getByRole('img', { name: 'Quark-Elec' }).getAttribute('src'),
  ).toBe('/brands/quark-elec.png')
  fireEvent.error(screen.getByRole('img'))
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.getByText('Quark-Elec')).toBeDefined()
  rerender(<AssetBrandLogo brand="Garmin" />)
  expect(screen.getByRole('img', { name: 'Garmin' })).toBeDefined()
})

it('shows unknown brands as text and omits absent brands', () => {
  const { rerender } = render(<AssetBrandLogo brand="Custom Marine" />)
  expect(screen.getByText('Custom Marine')).toBeDefined()
  expect(screen.queryByRole('img')).toBeNull()
  rerender(<AssetBrandLogo brand={null} />)
  expect(screen.queryByText('Custom Marine')).toBeNull()
})
