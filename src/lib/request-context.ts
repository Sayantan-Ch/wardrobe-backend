import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
  userId?: string;
  userRole?: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export const runWithRequestContext = <T>(context: RequestContext, callback: () => T): T => {
  return requestContextStorage.run(context, callback);
};

export const getRequestContext = (): RequestContext | undefined => {
  return requestContextStorage.getStore();
};

export const updateRequestContext = (patch: Partial<RequestContext>) => {
  const context = requestContextStorage.getStore();

  if (!context) {
    return;
  }

  Object.assign(context, patch);
};
