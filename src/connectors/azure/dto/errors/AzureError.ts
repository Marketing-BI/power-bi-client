import { setMessageParams } from '../../../../utils';

const BASIC_ERROR_TEXT = 'Azure Client ends with error.';

export class AzureError extends Error {
  constructor(message: string, params?: Record<string, any> | null, stack?: string) {
    super(setMessageParams(BASIC_ERROR_TEXT + ' ' + message, params || {}));
    this.name = 'AzureError';
    this.stack = stack;
  }

  static ERROR_CODE = {
    GENERATING_ACCESS_TOKEN_EXCEPTION: 'An Error with generating token occurred.',
  };
}
