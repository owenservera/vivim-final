import React, { type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
}

function AllProviders({ children, queryClient }: { children: ReactNode; queryClient: QueryClient }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function customRender(ui: ReactElement, options: CustomRenderOptions = {}) {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options;

  // eslint-disable-next-line react/no-children-prop
  return render(ui, {
    wrapper: ({ children }) => React.createElement(AllProviders, { queryClient, children }),
    ...renderOptions,
  });
}

export * from '@testing-library/react';
export { customRender as render };
export { createTestQueryClient };
