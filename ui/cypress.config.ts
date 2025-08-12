import { defineConfig } from "cypress";
import { fromNodeProviderChain } from '@aws-sdk/credential-providers'

async function resolveAWSCreds(config: Cypress.PluginConfigOptions) {
  const awscredentials = await fromNodeProviderChain()();
  config.env.awscredentials = awscredentials
  return config;
}

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    setupNodeEvents(on, config) {
      // implement node event listeners here
      return resolveAWSCreds(config);
    },
  },
});
