import { FabricClient, PowerBiClient } from '../connectors/azure';
import { FabricService } from './fabric.service';
import { PowerBiService } from './powerBi.service';

const azureConfig = {
  clientId: process.env.AZURE_PB_CLIENT_ID!,
  clientSecret: process.env.AZURE_PB_CLIENT_SECRET!,
  tenantId: process.env.AZURE_PB_TENANT_ID!,
};

const fabricClient = new FabricClient(azureConfig);
const fabricService = new FabricService(fabricClient);
const powerBiService = new PowerBiService(new PowerBiClient(azureConfig), fabricClient);

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

  describe('deleteRecursive', () => {
    const basePath = 'ITest/DeleteRecursive';

    it('Should delete all contents of a folder without deleting the folder itself', async () => {
      // Arrange – create a nested structure under the target folder
      await fabricService.getFolderOrCreate(testingWorkspace, `${basePath}/Child1/GrandChild1`);
      await fabricService.getFolderOrCreate(testingWorkspace, `${basePath}/Child2`);

      // Act
      await expect(
        fabricService.deleteRecursive(testingWorkspace, basePath, { deleteSelf: false }),
      ).resolves.toBeUndefined();

      // Assert – target folder still exists but has no children
      const foldersAfter = await fabricService.listFolders(testingWorkspace, { recursive: true });
      const targetFolder = foldersAfter.find(
        (f) => f.displayName === 'DeleteRecursive' && f.workspaceId === testingWorkspace,
      );
      expect(targetFolder).toBeTruthy();

      const children = foldersAfter.filter((f) => f.parentFolderId === targetFolder!.id);
      expect(children).toHaveLength(0);

      // Cleanup
      await fabricService.deleteRecursive(testingWorkspace, basePath, { deleteSelf: true });
    });

    it('Should delete all contents AND the folder itself when deleteSelf is true', async () => {
      // Arrange
      await fabricService.getFolderOrCreate(testingWorkspace, `${basePath}/Child1/GrandChild1`);
      await fabricService.getFolderOrCreate(testingWorkspace, `${basePath}/Child2`);

      // Act
      await expect(
        fabricService.deleteRecursive(testingWorkspace, basePath, { deleteSelf: true }),
      ).resolves.toBeUndefined();

      // Assert – the target folder itself no longer exists
      const foldersAfter = await fabricService.listFolders(testingWorkspace, { recursive: true });
      const targetFolder = foldersAfter.find(
        (f) => f.displayName === 'DeleteRecursive' && f.workspaceId === testingWorkspace,
      );
      expect(targetFolder).toBeUndefined();

      // Cleanup the parent ITest folder if left over
      const iTestFolder = foldersAfter.find((f) => f.displayName === 'ITest' && f.workspaceId === testingWorkspace);
      if (iTestFolder) {
        await fabricService.deleteRecursive(testingWorkspace, 'ITest', { deleteSelf: true });
      }
    });

    it('Should be a no-op when the folder path does not exist', async () => {
      await expect(
        fabricService.deleteRecursive(testingWorkspace, 'ITest/NonExistentFolder/Deep', { deleteSelf: true }),
      ).resolves.toBeUndefined();
    });
  });

  describe('deleteWorkspace', () => {
    it('Should create a workspace via PowerBiService and delete it via FabricService', async () => {
      const workspaceName = `ITest-DeleteWorkspace-${Date.now()}`;

      // Create the workspace through the Power BI API
      const createdGroup = await powerBiService.createGroup(workspaceName);
      expect(createdGroup).not.toBeUndefined();
      expect(createdGroup.id).not.toBeUndefined();
      expect(createdGroup.name).toBe(workspaceName);

      // Verify it shows up in the list of Fabric workspaces
      const workspaces = await fabricService.listWorkspaces();
      const found = workspaces.find((w) => w.id === createdGroup.id);
      expect(found).toBeTruthy();

      // Delete it through the Fabric API
      await expect(fabricService.deleteWorkspace(createdGroup.id)).resolves.toBeUndefined();

      // Verify it is no longer listed
      const workspacesAfter = await fabricService.listWorkspaces();
      const foundAfter = workspacesAfter.find((w) => w.id === createdGroup.id);
      expect(foundAfter).toBeUndefined();
    });
  });
});
