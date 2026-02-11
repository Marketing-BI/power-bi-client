import { FabricClient } from '../connectors/azure';
import { FabricService } from './fabric.service';

const fabricService = new FabricService(
  new FabricClient({
    clientId: process.env.AZURE_PB_CLIENT_ID!,
    clientSecret: process.env.AZURE_PB_CLIENT_SECRET!,
    tenantId: process.env.AZURE_PB_TENANT_ID!,
  }),
);

const testingWorkspace = process.env.FABRIC_TESTING_WORKSPACE_ID!;

describe('FabricService Integration test', () => {
  it('Should get or create folders by names', async () => {
    const nestedFolderPath = 'ITest/Deeply/Nested/Folder';
    const createdFolder = await fabricService.getFolderOrCreate(testingWorkspace, nestedFolderPath);
    expect(createdFolder).not.toBeUndefined();
    expect(createdFolder.id).not.toBeUndefined();
    expect(createdFolder.displayName).toBe('Folder');
    expect(createdFolder.workspaceId).toBe(testingWorkspace);
    expect(createdFolder.parentFolderId).not.toBeUndefined();

    const folders = await fabricService.listFolders(testingWorkspace, { recursive: true });
    const gotFolder = await fabricService.getFolderOrCreate(testingWorkspace, nestedFolderPath);

    expect(gotFolder).toEqual(createdFolder);
    const folders2 = await fabricService.listFolders(testingWorkspace, { recursive: true });

    expect(folders2.length).toEqual(folders.length);

    const shouldCreateReversed = nestedFolderPath.split('/').toReversed();
    for (const folder of shouldCreateReversed) {
      const fabricFolder = folders.find((f) => f.displayName === folder && f.workspaceId === testingWorkspace);
      expect(fabricFolder).toBeTruthy();
      await expect(fabricService.deleteFolder(testingWorkspace, fabricFolder!.id)).resolves.toBeUndefined(); // deleting folders should succeed, even if they are not empty, as deletion is recursive
    }
  });
});
