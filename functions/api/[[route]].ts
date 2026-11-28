import { handleD1ApiRequest } from '../_shared/d1Api';
import type { PagesFunctionContext } from '../_shared/d1Types';

export const onRequest = async (context: PagesFunctionContext): Promise<Response> => {
  return handleD1ApiRequest(context.request, context.env);
};
