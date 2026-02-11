export interface ISnowflakeCredentials {
  /**
   * Snowflake server url
   */
  host: string;
  /**
   * Snowflake server port
   */
  port?: number | null;
  /**
   * User used for connection
   */
  user: string;
  /**
   * Password used for connection
   */
  password: string;
  /**
   * Warehouse`s name
   */
  warehouse: string;
  /**
   * Schema`s name
   */
  schema: string;
  /**
   * Database`s name
   */
  database: string;
}

export interface IBigQueryCredentials {
  /**
   * Service Account JSON used for authentication with Google BigQuery
   */
  saJson: string;
}

export interface ISourceSystemPBIConfig {
  pathToTemplateFile: string;
  templateGroupId: string;
  credentialsTemplate?: Array<CredentialTemplateItem>;
  datasourceParamsTemplate?: Array<DatasourceParamTemplateItem>;
}

export interface CredentialTemplateItem {
  /**
   * Contains type of the attribute to be taken from credentials.
   *
   * @example "PASSWORD"
   */
  type: CredentialTemplateItemEnum;
  /**
   * Contains name of the attribute to be used for credentials.
   *
   * @example "password"
   */
  name: string;
  /**
   * Use this value to override value taken from credential.
   * By default, value is taken from credential object. If this overrideValue is present => application use this value instead of value from credentials.
   *
   * @example "some-value-to-be-used"
   */
  overrideValue?: string;
}

export interface DatasourceParamTemplateItem {
  type: DatasourceParamTemplateItemEnum;
  name: string;
}

export interface IDatasetSchedule {
  /**
   * Array of time in 24h format, for example ['14:00']
   */
  times: Array<string>;

  /**
   * Array of days of the week
   * If left undefined or an empty array, all days of the week are considered for the refresh schedules
   */
  days?: Array<string>;
}

export enum CredentialTemplateItemEnum {
  USERNAME = 'USERNAME',
  PASSWORD = 'PASSWORD',
  SA_JSON = 'SA_JSON', // Service Account JSON, used for Google BigQuery
}

export enum DatasourceParamTemplateItemEnum {
  DATABASE_NAME = 'DATABASE_NAME',
  HOSTNAME = 'HOSTNAME',
  WAREHOUSE = 'WAREHOUSE',
  SCHEMA = 'SCHEMA',
}
