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
import {
    CredentialTemplateItem,
    CredentialTemplateItemEnum,
    DatasourceParamTemplateItem,
    DatasourceParamTemplateItemEnum, IDatasetSchedule,
    ISnowflakeCredentials,
    ISourceSystemPBIConfig,
} from '../interfaces';

const DEFAULT_SCHEDULED_TIMES: Array<string> = ['03:00'];

export class PowerBiConfigDto {
    // Dynamically changed by every new client
    readonly capacityId: string;
    readonly name: string;
    readonly datasourceCredentials: PBICredentialDetails
    readonly datasourceParams: Array<PBIDatasourceParam> = new Array<PBIDatasourceParam>();
    readonly scheduledTimes: Array<string> | undefined;
    readonly scheduledDays: Array<string> | undefined;

    // Changed only by administrators
    private readonly _pathToTemplateFile: string;
    readonly templateGroupId: string;
    // Specific by implementation
    private readonly _templateSupplier: Function;
    private template: Buffer;

    constructor(
        name: string,
        snowflakeCredentialDetails: ISnowflakeCredentials,
        sourceSystemPBIConfig: ISourceSystemPBIConfig,
        templateSupplier: Function,
        schedule?: IDatasetSchedule,
        capacityId?: string
    ) {
        this.name = name;
        if(sourceSystemPBIConfig.credentialsTemplate){
            const credentials: PBICredentials = {
                credentialData: sourceSystemPBIConfig.credentialsTemplate.map((templateItem) => mapCredentials(templateItem, snowflakeCredentialDetails))}
            this.datasourceCredentials = createBasicCredentials(credentials);

        }
        if(sourceSystemPBIConfig.datasourceParamsTemplate){
            sourceSystemPBIConfig.datasourceParamsTemplate
                .map((item) => mapDatasourceParam(item, snowflakeCredentialDetails))
                .forEach((datasourceParam) => this.datasourceParams.push(datasourceParam))
            ;
        }

        this.capacityId = capacityId;
        this.scheduledTimes = schedule && schedule.times && schedule.times.length > 0 ? schedule.times : undefined;
        this.scheduledDays = schedule && schedule.days && schedule.days.length > 0 ? schedule.days : undefined;

        this._pathToTemplateFile = sourceSystemPBIConfig.pathToTemplateFile;
        this.templateGroupId = sourceSystemPBIConfig.templateGroupId;
        this._templateSupplier = templateSupplier;
    }

    public async getTemplate(): Promise<Buffer> {
        if (this.template === undefined || this.template === null){
            this.template = await this._templateSupplier(this._pathToTemplateFile);
        }

        return this.template
    }

}

const mapCredentials = (templateItem: CredentialTemplateItem, snowflakeCredentialDetails: ISnowflakeCredentials):  PBICredentialDataItem => {
    if (templateItem.overrideValue) {
        return {
            name: templateItem.name,
            value: templateItem.overrideValue,
        };
    }

    switch (templateItem.type) {
        case CredentialTemplateItemEnum.PASSWORD:
            return {
                name: templateItem.name,
                value: snowflakeCredentialDetails.password,

            };
        case CredentialTemplateItemEnum.USERNAME:
            return {
                name: templateItem.name,
                value: snowflakeCredentialDetails.user,

            }
    }

}

const mapDatasourceParam = (templateItem: DatasourceParamTemplateItem, snowflakeCredentialDetails: ISnowflakeCredentials):  PBIDatasourceParam => {
    switch (templateItem.type) {
        case DatasourceParamTemplateItemEnum.DATABASE_NAME:
            return {
                name: templateItem.name,
                newValue: snowflakeCredentialDetails.database,

            };
        case DatasourceParamTemplateItemEnum.HOSTNAME:
            return {
                name: templateItem.name,
                newValue: snowflakeCredentialDetails.host,
            };
        case DatasourceParamTemplateItemEnum.SCHEMA:
            return {
                name: templateItem.name,
                newValue: snowflakeCredentialDetails.schema,

            };
        case DatasourceParamTemplateItemEnum.WAREHOUSE:
            return {
                name: templateItem.name,
                newValue: snowflakeCredentialDetails.warehouse,
            };
    }

}

const createBasicCredentials = (credentials: PBICredentials): PBICredentialDetails => {
    return  {
        "credentialType": PBICredentialTypeEnum.Basic,
        "credentials": JSON.stringify(credentials),
        "encryptedConnection": PBIEncryptedConnectionEnum.NotEncrypted,
        "encryptionAlgorithm": PBIEncryptionAlgorithmEnum.None,
        "privacyLevel": PBIPrivacyLevelEnum.None,
        "useEndUserOAuth2Credentials": false,
    };
}
