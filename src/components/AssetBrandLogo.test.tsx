// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { ASSET_BRANDS } from '../domain/asset-brands'
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

it('uses the canonical name for a catalog brand without a verified logo', () => {
  const brand = ASSET_BRANDS.find((entry) => !entry.logo)!
  render(<AssetBrandLogo brand={brand.id} />)
  expect(screen.getByText(brand.name)).toBeDefined()
  expect(screen.queryByRole('img')).toBeNull()
})

it('marks white artwork for readable rendering on light surfaces', () => {
  const brand = ASSET_BRANDS.find((entry) => entry.logo && entry.whiteLogo)!
  render(<AssetBrandLogo brand={brand.name} />)
  expect(
    screen.getByRole('img').classList.contains('asset-brand-logo--white'),
  ).toBe(true)
})
