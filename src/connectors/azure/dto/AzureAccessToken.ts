
export class AzureAccessToken {
    private readonly _accessToken: string;
    private readonly _expireAt: number;


    constructor(accessToken: string, expireAt: number) {
        this._accessToken = accessToken;
        this._expireAt = expireAt;
    }


    get accessToken(): string {
        return this._accessToken;
    }

    get expireAt(): number {
        return this._expireAt;
    }
}
