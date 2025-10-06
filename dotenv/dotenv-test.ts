/* eslint-disable import/no-extraneous-dependencies */
const path = require('path');
import * as dotenv from "dotenv";

module.exports = async () => {
    dotenv.config({ path: path.resolve(__dirname, '../env/.env.test') });
};
