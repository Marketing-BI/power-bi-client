const BASIC_ERROR_TEXT = 'Http Call ends with error.'

export class HttpError extends Error {

    constructor(message: string, params?: Record<string, any>) {
        super(setMessageParams(BASIC_ERROR_TEXT + ' ' + message, params));
        this.name = 'Http';
    }

    static ERROR_MESSAGES = {
        MISSING_INIT_CONFIGURATION: 'No Retries left.',
        MISSING_REQUIRED_PARAM: 'Missing Required param: %PARAMS%',
        COMMUNICATION_ERROR: 'Http communication responded with an error status: %STATUS%, %STATUS_TEXT%. Please try it later.'
    }

}

const setMessageParams = (message: string, params?: Record<string, any>) => {
    let msg: string = message;
    if (msg && params){
        for (const key of Object.keys(params)) {
            msg = msg.replace(key, params[key]);
        }
    }

    return msg;
}


