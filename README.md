# @marketing-bi/power-bi-client

Node.js client for automating Power BI workspace and report lifecycle: initialize workspaces from templates, import
PBIX, update dataset parameters and credentials, trigger refreshes and schedules, and generate embed tokens.

## 📝 License

Copyright © 2025 MBI (mbi.io). All rights reserved.

This software, its source code, object code, documentation, and all related materials are proprietary to MBI.

Use, copying, modification, distribution, or any other exploitation of this software by any person or entity outside of
MBI is strictly prohibited.

Any permitted use within MBI is subject to internal policies and agreements.

THIS SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.

> **Note:** We are working on licensing terms that will allow us to release this tool as "open-source" in the near
> future. But until that happens, the conditions listed above apply.

## 📄 Table of Contents

- [📝 License](#-license)
- [🚀 Quick start guide](#-quick-start-guide)
  - [List of .env variables](#list-of-env-variables)
- [💻 Contributing](#-contributing)
  - [Branch management](#branch-management)
- [🪵 Changelog](#-change-log)

## 🚀 Quick start guide

Prerequisites:

- Node.js 18+ (recommended 22+)
- Access to Azure AD app with permissions to call Power BI REST API
- Power BI workspace permissions

Install dependencies and build:

```bash
npm install
npm run build_ts
```

Run tests (optional):

Set up ENV vars in `env/.env.test` file:

```console
AZURE_AUTHORITY=
AZURE_PB_CLIENT_ID=
AZURE_PB_CLIENT_SECRET=
AZURE_PB_RESOURCE=
AZURE_PB_TENANT_ID=
AZURE_PB_SECRET_ID=

FABRIC_TESTING_WORKSPACE_ID=e61bd332-9268-4f92-a8c4-b3ccee2363a7
```

```bash
npm test
```

Use in your Node.js/TypeScript project (example):

```ts
import { PowerBiClient, PowerBiConfigDto, PowerBiConfig } from '@marketing-bi/power-bi-client';

const config: PowerBiConfig = {
  azureConfig: {
    tenantId: process.env.AZURE_PB_TENANT_ID as string,
    clientId: process.env.AZURE_PB_CLIENT_ID as string,
    clientSecret: process.env.AZURE_PB_CLIENT_SECRET as string,
  },
};

const client = new PowerBiClient(config);
```

### List of .env variables

Create a `.env` file in the project root folder and set the following variables:

- POWER_BI_GROUP_PREFIX: Optional prefix for newly created workspaces

## 💻 Contributing

Contributing is now only allowed for the internal members of the MBI team. Once, and if this software becomes open in
any way, this section will be updated accordingly.

### Branch management

Branches in git follow this logic:

- **master**: main branch containing the production version of the software.
- **stage**: testing version containing latest features which are currently undergoing UAT.
- **dev**: unified storage for features currently in development, which are expeceted to move to UAT soon.

Other branches contain individual features in development.

## 🪵 Change log

### v2.2.0

#### Added

##### FabricService

- Remove workspace API call
- Recursively delete folders
- Remove single PBI item

### v2.1.1

#### Fixes

- Fix get dataset in group using folder path as well

### v2.1.0

#### Changes

- Exposed methods
  - listDatasourcesInGroup
  - datasetUpdateParameters
  - gatewayDatasourceUpdate

Do not automatically trigger `gatewayDatasourceUpdate` when importing PBIX to PBI

### v2.0.0

#### Breaking changes

PowerBI service now supports only Google SA credentials!
Changed PowerBIConfig DTO API.

#### Added

- Fabric Service
  - Create folders (even by name!)
  - List folders
- Power BI Import to folder
  - Add parent folder ID param to import of PBIX

### v1.0.0

- Initial public release.
