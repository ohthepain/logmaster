# travelmode.live

Build Command
Local dev: pnpm cap:sync:dev + pnpm dev (webview loads http://localhost:3020)
TestFlight: pnpm ios:beta (webview loads https://logmaster.live)
App Store / live: pnpm ios:archive (webview loads https://logmaster.live)

How to run in the simulator and see the logs:
Terminal 1
pnpm dev
Terminal 2
pnpm cap:sync:dev
pnpm cap:ios
Then Run in Xcode (Cmd+R).

old instructions:
Run in Xcode: npx cap sync ios (doesn't work)
Run in simulator: pnpm cap:run:ios

Sailing logbook PWA: start a trip, capture notes and media offline,
and sync the log when connectivity returns.

**Stack:** TanStack Start, Hono (`/api/*`), Prisma + Postgres, pg-boss, Better Auth, MapLibre, Zustand.

## Local setup

```bash
pnpm install
# Ensure the shared octacard Postgres server is running on localhost:5432
# and the `logmaster` database exists (see .env.example).
pnpm db:migrate
pnpm dev
```

Copy `.env.example` to `.env`, set `DATABASE_URL` (octacard user, `logmaster` database on port 5432), and set
`VITE_MAPTILER_API_KEY` for the server tile proxy at `/api/map-tiles/...` (avoids MapTiler 403s from
browser referrer rules).
Set `BETTER_AUTH_URL` to the same origin you use in the browser (e.g. `http://localhost:3020` for
`pnpm dev`) so OAuth state cookies validate. Optional: `pnpm worker` in another terminal to process
background map data jobs if the API process does not run the worker.

### Google sign-in

Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env` (see `.env.example`). In Google Cloud Console, configure:

- **Authorized redirect URI:** `{BETTER_AUTH_URL}/api/auth/callback/google` (local: `http://localhost:3020/api/auth/callback/google`)
- **Authorized JavaScript origin:** the same origin as `BETTER_AUTH_URL` (scheme + host + port)

Then open `/sign-in` and use **Continue with Google**. Restart `pnpm dev` after changing `.env`.

**Native app (TestFlight / App Store):** Web-based Google OAuth opens Safari and fails with `state_mismatch` because the OAuth state cookie lives in the WebView, not the system browser. The iOS/Android shell uses native Google Sign-In instead (`@capawesome/capacitor-google-sign-in`) and passes the ID token to Better Auth — no browser redirect.

1. In Google Cloud Console, create an **iOS** OAuth client for bundle id `live.logmaster.app`.
2. Set `GOOGLE_IOS_CLIENT_ID` in your environment (or `ios/fastlane/.env` for local archives).
3. Run `pnpm ios:beta` or `pnpm ios:archive` — `ios:prearchive` writes `GIDClientID` and the URL scheme into `Info.plist`.

The server exposes the web client id at `/api/health` (`googleWebClientId`) for the native plugin; keep `GOOGLE_CLIENT_ID` as the **Web** client id in ECS secrets.

### Email (Amazon SES)

Auth emails (sign-up verification, password reset, magic link) go through SES when `AWS_SES_FROM_EMAIL`
is set. In deployed environments the ECS task role sends mail in **eu-central-1** — no static AWS keys.

For local dev, add to `.env`:

```bash
AWS_REGION=eu-central-1
AWS_SES_FROM_EMAIL=no-reply@logmaster.live
SES_CONFIGURATION_SET=logmaster-live
```

Use an address on a verified SES identity in that region (`logmaster.live` is verified and covers
`@staging.logmaster.live` senders). If `AWS_SES_FROM_EMAIL` is unset, the app logs email bodies to
the console instead of sending.

Test a send with your AWS CLI profile:

```bash
AWS_REGION=eu-central-1 AWS_SES_FROM_EMAIL=no-reply@logmaster.live \
  pnpm exec tsx scripts/send-test-email.ts you@example.com
```

## Deployment

./scripts/tf-plan.sh production
./scripts/tf-plan.sh staging
./scripts/tf-apply.sh production
./scripts/tf-apply.sh staging

# Getting Started

To run this application:

```bash
pnpm install
pnpm dev
```

# Building For Production

To build this application for production:

```bash
pnpm build
```

## Testing

This project uses [Vitest](https://vitest.dev/) for testing. You can run the tests with:

```bash
pnpm test
```

## Linting & Formatting

This project uses [ESLint](https://eslint.org/) for linting and [Biome](https://biomejs.dev/) for formatting. ESLint is configured using [tanstack/eslint-config](https://tanstack.com/config/latest/docs/eslint). The following scripts are available:

```bash
pnpm lint
pnpm format
pnpm check
```

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "My App" },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
});
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from "@tanstack/react-start";

const getServerTime = createServerFn({
  method: "GET",
}).handler(async () => {
  return new Date().toISOString();
});

// Use in a component
function MyComponent() {
  const [time, setTime] = useState("");

  useEffect(() => {
    getServerTime().then(setTime);
  }, []);

  return <div>Server time: {time}</div>;
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";

export const Route = createFileRoute("/api/hello")({
  server: {
    handlers: {
      GET: () => json({ message: "Hello, World!" }),
    },
  },
});
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/people")({
  loader: async () => {
    const response = await fetch("https://swapi.dev/api/people");
    return response.json();
  },
  component: PeopleComponent,
});

function PeopleComponent() {
  const data = Route.useLoaderData();
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  );
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

# Demo files

Files prefixed with `demo` can be safely deleted. They are there to provide a starting point for you to play around with the features you've installed.

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
