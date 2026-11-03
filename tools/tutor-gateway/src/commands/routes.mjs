import { readFileSync } from 'node:fs';

const appRoutesUrl = new URL('../../../../frontend/src/config/app-routes.json', import.meta.url);
const appRoutes = JSON.parse(readFileSync(appRoutesUrl, 'utf8'));

export const navigationRoutes = appRoutes;

function applyRouteParams(path, routeParams = {}) {
  return path.replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
    const value = routeParams[name];
    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing route parameter: ${name}`);
    }
    return encodeURIComponent(String(value));
  });
}

export function buildNavigationAction({ route, route_params = {} }) {
  const routeDefinition = navigationRoutes.find((candidate) => candidate.id === route);
  if (!routeDefinition) {
    return null;
  }

  const paramsWithDefaults = Object.fromEntries(
    (routeDefinition.params || [])
      .filter((param) => param.default !== undefined)
      .map((param) => [param.name, param.default]),
  );
  const finalRouteParams = { ...paramsWithDefaults, ...route_params };

  return {
    type: 'navigate',
    to: applyRouteParams(routeDefinition.path, finalRouteParams),
    title: routeDefinition.title,
  };
}

export function getPublicRoutes() {
  return navigationRoutes.map(({ id, title, path, assistantDescription, params }) => ({
    id,
    title,
    path,
    to: path.includes(':') ? null : path,
    assistantDescription,
    params,
  }));
}

export function getAssistantRouteGuide() {
  return navigationRoutes.map((route) => {
    const params = route.params?.length
      ? route.params
          .map((param) => `${param.name}${param.required ? '' : '?'}:${param.type}`)
          .join(', ')
      : 'none';

    return {
      route: route.id,
      title: route.title,
      path: route.path,
      description: route.assistantDescription,
      params,
      hints: route.hints,
    };
  });
}

export function getAssistantRouteGuideText() {
  return getAssistantRouteGuide()
    .map((route) => {
      const hints = route.hints.length ? ` hints: ${route.hints.join(', ')}` : '';
      return `route=${route.route}; path=${route.path}; params=${route.params}; ${route.description}${hints}`;
    })
    .join('\n');
}
