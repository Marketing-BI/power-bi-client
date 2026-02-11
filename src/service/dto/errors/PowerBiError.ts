import { setMessageParams } from '../../../utils';

const BASIC_ERROR_TEXT = 'Power Bi Client ends with error.';

export class PowerBiError extends Error {
  constructor(message: string, params?: Record<string, any>) {
    super(setMessageParams(BASIC_ERROR_TEXT + ' ' + message, params));
    this.name = 'PowerBiError';
  }

  static PARAM_NAMES = {
    PARAMS: '%PARAMS%',
    RESOURCE_NAME: '%RESOURCE_NAME%',
    RESOURCE_ID: '%RESOURCE_ID%',
    SOURCE_SYSTEM: '%SOURCE_SYSTEM%',
    STATUS: '%STATUS%',
    STATUS_TEXT: '%STATUS_TEXT%',
  };

  static ERROR_MESSAGES = {
    RESOURCE_NOT_FOUND: `Resource not found: ${PowerBiError.PARAM_NAMES.PARAMS}`,
    UNEXPECTED_CREATION_ERROR: 'Unexpected error with PBI WS creation!',
    MISSING_INIT_CONFIGURATION: 'No Retries left.',
    MISSING_REQUIRED_PARAM: `Missing Required param: ${PowerBiError.PARAM_NAMES.PARAMS}`,
    COMMUNICATION_ERROR: `Power BI api response error status: ${PowerBiError.PARAM_NAMES.STATUS}, ${PowerBiError.PARAM_NAMES.STATUS_TEXT}. Please try it later.`,
    UNKNOWN_SOURCE_SYSTEM: `For given source system "${PowerBiError.PARAM_NAMES.SOURCE_SYSTEM}" configuration not exists.`,
    UNKNOWN_RESOURCE: `Given resource "${PowerBiError.PARAM_NAMES.RESOURCE_NAME}" with id: "${PowerBiError.PARAM_NAMES.RESOURCE_ID}" not found.`,
    FAILED_IMPORT: 'Failed to import into workspace.',
  };

  static RESOURCE_NAMES = {
    CAPACITY: 'Capacity',
  };

  toString(): string {
    return JSON.stringify(this);
  }
}
