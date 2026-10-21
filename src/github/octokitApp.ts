import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { config } from "../config.js";

export function createInstallationOctokit(
  installationId: number,
): Octokit {
  if (!config.appId || !config.privateKey) {
    throw new Error("APP_ID and PRIVATE_KEY required for worker");
  }

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: config.appId,
      privateKey: config.privateKey,
      installationId,
    },
  });
}
