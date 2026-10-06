import { RenderMode, ServerRoute } from '@angular/ssr';

// This app is an authenticated internal tool with no public/SEO pages, so there's no
// benefit to prerendering or per-request SSR here — and RenderMode.Prerender on '**'
// would fail at build time for dynamic routes like invoices/:id anyway (Angular needs
// getPrerenderParams to know which ids exist, which doesn't apply to a live database).
// RenderMode.Client renders every route as a normal client-side SPA while still
// satisfying angular.json's server/ssr build options.
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
