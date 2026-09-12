# Asset brand logos

The shared catalog is `src/domain/asset-brands.ts`. Add a canonical name, aliases,
and a local logo path there to make a brand available throughout the asset UI.
Users can also enter an unlisted brand; it displays as text until a logo is added.

Logos are bundled locally so asset rendering does not depend on third-party
image services. These marks identify the manufacturer of user-owned equipment.
Sources retrieved 2026-09-12:

| File | Official source | Preparation |
| --- | --- | --- |
| `quark-elec.png` | https://www.quark-elec.com/wp-content/uploads/2026/01/Copy-of-Navy-Blue-and-Gold-Classy-and-Elegant-Personal-Christmas-Outdoor-Banner-3.png | Original transparent wordmark |
| `garmin.svg` | https://www.garmin.com/en-US/ | Extracted header SVG |
| `raymarine.svg` | https://www.raymarine.com/img/logo--raymarine-mobile.svg | White fills changed to navy for light surfaces |
| `victron-energy.svg` | https://www.victronenergy.com | Extracted header SVG; website fill classes replaced with Victron blue |

The UI renders transparent marks in white on dark surfaces. Do not add remote
logo URLs or executable SVG content. Keep paths and manufacturer names intact.
