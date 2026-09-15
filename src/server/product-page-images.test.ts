import { expect, it } from 'vitest'
import { extractManufacturerImageUrls } from './product-page-images'

it('prefers manufacturer images encoded in Next.js optimizer URLs', () => {
  const html = `
    <img src="/_next/image?url=https%3A%2F%2Fwww.victronenergy.com%2Fupload%2Fproducts%2FSmartshunt%2520IP65%2520NEW.png&amp;w=3840&amp;q=70" />
    <img src="https://cdn.example.com/retailer-photo.png" />
  `
  expect(
    extractManufacturerImageUrls(
      html,
      'https://www.victronenergy.com/battery-monitors/smart-battery-shunt',
    ),
  ).toEqual([
    'https://www.victronenergy.com/upload/products/Smartshunt%20IP65%20NEW.png',
    'https://cdn.example.com/retailer-photo.png',
  ])
})

it('reads Open Graph images before other candidates', () => {
  const html = `
    <meta property="og:image" content="https://www.example.com/media/catalog/product/front.png" />
    <img src="https://www.example.com/media/catalog/product/side.png" />
  `
  expect(
    extractManufacturerImageUrls(html, 'https://www.example.com/product'),
  ).toEqual([
    'https://www.example.com/media/catalog/product/front.png',
    'https://www.example.com/media/catalog/product/side.png',
  ])
})
