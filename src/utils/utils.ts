export const setMessageParams = (message: string, params?: Record<string, any>) => {
    let msg: string = message;
    if (msg && params){
        for (const key of Object.keys(params)) {
            msg = msg.replace(key, params[key]);
        }
    }

    return msg;
}
