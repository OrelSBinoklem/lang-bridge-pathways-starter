import appRoutes from './app-routes.json';

export type AppRouteParam = {
  name: string;
  type: 'number' | 'string';
  required: boolean;
  default?: number | string;
  description: string;
};

export type AppRouteDefinition = {
  id: string;
  title: string;
  path: string;
  assistantDescription: string;
  hints: string[];
  params: AppRouteParam[];
};

export const APP_ROUTES = appRoutes as AppRouteDefinition[];

export function buildAssistantRouteGuide() {
  return APP_ROUTES.map((route) => {
    const params = route.params.length
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
