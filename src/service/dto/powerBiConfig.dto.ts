import { Buffer } from 'buffer';
import {
  PBICredentialDataItem,
  PBICredentialDetails,
  PBICredentials,
  PBICredentialTypeEnum,
  PBIDatasourceParam,
  PBIEncryptedConnectionEnum,
  PBIEncryptionAlgorithmEnum,
  PBIPrivacyLevelEnum,
} from '../powerBI.interfaces';
import { type IDatasetSchedule, type ISourceSystemPBIConfig, type IBigQueryCredentials } from '../interfaces';

const DEFAULT_SCHEDULED_TIMES: Array<string> = ['03:00'];

export class PowerBiConfigDto {
  // Dynamically changed by every new client
  readonly capacityId?: string;
  readonly name: string;
  datasourceCredentials?: PBICredentialDetails = undefined;
  readonly scheduledTimes: Array<string> | undefined;
  readonly scheduledDays: Array<string> | undefined;
  readonly importFolderId: string;
  // Changed only by administrators
  private readonly _pathToTemplateFile: string;
  readonly templateGroupId: string;
  // Specific by implementation
  private readonly _templateSupplier: (pathToTemplateFile: string) => Promise<Buffer>;
  private template?: Buffer = undefined;

  /**
   * This here contains the parameters that change the or views referenced by the PowerBI template
   */
  public datasourceParams: Array<PBIDatasourceParam> = new Array<PBIDatasourceParam>();

  constructor(
    name: string,
    credentialDetails: IBigQueryCredentials,
    sourceSystemPBIConfig: ISourceSystemPBIConfig,
    templateSupplier: (pathToTemplateFile: string) => Promise<Buffer>,
    importFolderId: string,
    schedule?: IDatasetSchedule,
    capacityId?: string,
  ) {
    this.name = name;
    this.importFolderId = importFolderId;
    this.datasourceCredentials = createPbiCredentials(credentialDetails.saJson);
    this.capacityId = capacityId;
    this.scheduledTimes = schedule && schedule.times && schedule.times.length > 0 ? schedule.times : undefined;
    this.scheduledDays = schedule && schedule.days && schedule.days.length > 0 ? schedule.days : undefined;

    this._pathToTemplateFile = sourceSystemPBIConfig.pathToTemplateFile;
    this.templateGroupId = sourceSystemPBIConfig.templateGroupId;
    this._templateSupplier = templateSupplier;
  }

  public async getTemplate(): Promise<Buffer> {
    if (this.template === undefined || this.template === null) {
      this.template = await this._templateSupplier(this._pathToTemplateFile);
    }

    return this.template!;
  }
}

const createPbiCredentials = (credentials: Readonly<PBICredentials>): PBICredentialDetails => {
  return {
    credentialType: PBICredentialTypeEnum.Basic,
    credentials: JSON.stringify(credentials),
    encryptedConnection: PBIEncryptedConnectionEnum.Encrypted,
    encryptionAlgorithm: PBIEncryptionAlgorithmEnum.None,
    privacyLevel: PBIPrivacyLevelEnum.Organizational,
    useEndUserOAuth2Credentials: false,
  };
};
