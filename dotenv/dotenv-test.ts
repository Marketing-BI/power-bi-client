/* eslint-disable import/no-extraneous-dependencies */
const path = require('path');
import { config } from 'dotenv';

module.exports = async () => {
  config({ path: path.resolve(__dirname, '../env/.env.test') });
};
