import { AzureClient } from './index';
import { AzureAccessToken } from './dto/AzureAccessToken';
import { isValidToken } from './azure.client';

const azureClient: AzureClient = new AzureClient({
    clientId: process.env.AZURE_PB_CLIENT_ID,
    clientSecret: process.env.AZURE_PB_CLIENT_SECRET,
    tenantId: process.env.AZURE_PB_TENANT_ID,
});

describe("AzureClient", () => {
    it('Should create an token', async () => {

        const response = await azureClient.getToken()
        expect(response).not.toBeUndefined();
        expect(response.accessToken).not.toBeUndefined();
    });

    it('Should generate valid token', async () => {

        const response = await azureClient.generateValidToken(null);
        expect(response.accessToken).not.toBeNull();
        expect(response.accessToken).not.toBeUndefined();
        expect(response.expireAt).not.toBeNull();
        expect(response.expireAt).toBeGreaterThanOrEqual(Date.now());
        expect(isValidToken(response)).toBe(true);

        console.log(response);
    });

    it('Should validate token', async () => {

        const shift = 6 * 60 * 1000;
        const response = new AzureAccessToken('sadada', Date.now() + shift);
        expect(response.accessToken).not.toBeNull();
        expect(response.expireAt).not.toBeNull();
        expect(response.expireAt).toBeGreaterThanOrEqual(Date.now());
        expect(isValidToken(response)).toBe(true);

        console.log(response);
    });

    it('Should validate token - invalid', async () => {

        const response = new AzureAccessToken('sadada', Date.now());
        expect(response.accessToken).not.toBeNull();
        expect(response.expireAt).not.toBeNull();
        expect(response.expireAt).toBeLessThanOrEqual(Date.now());
        expect(isValidToken(response)).toBe(false);
    });

    describe('Custom scopes', () => {
        const customAzureClient: AzureClient = new AzureClient({
            clientId: process.env.AZURE_PB_CLIENT_ID,
            clientSecret: process.env.AZURE_PB_CLIENT_SECRET,
            tenantId: process.env.AZURE_PB_TENANT_ID,
            scopes: ['https://analysis.windows.net/powerbi/api/.default'],
        });

        it('Should create an token', async () => {

            const response = await customAzureClient.getToken()
            expect(response).not.toBeUndefined();
            expect(response.accessToken).not.toBeUndefined();
        });

    });


});
