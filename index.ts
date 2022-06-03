import * as core from "@actions/core";
import * as github from "@actions/github";
import { components } from "@octokit/openapi-types";

async function main() {
  const envs = core.getInput("env", { required: true, trimWhitespace: true });
  if (typeof envs != "string") throw new Error("Env must be a string");
  for (const env of envs.split(/\s+/g)) {
    await deployEnvironment(env);
  }
}

async function deployEnvironment(env: string) {
  if (!["dev", "stg", "prd", "biz"].includes(env)) throw new Error("Invalid environment=" + env);

  const dockerImage = core.getInput("dockerImage", { required: true, trimWhitespace: true });
  const serviceName = core.getInput("serviceName", { required: true, trimWhitespace: true });
  const token = core.getInput("token", { required: true });

  const octokit = github.getOctokit(token, {
    previews: ["ant-man-preview", "flash-preview"],
  });

  const { owner, repo } = github.context.repo;

  const resp = await octokit.rest.repos.createDeployment({
    owner,
    repo,
    ref: github.context.ref,
    environment: env,
    description: `Container deployment`,
    auto_merge: false,
    required_contexts: [],
    // this task is handled by the webhooks-receiver
    task: "dcl/container-deployment",
    payload: {
      sha: github.context.sha,
      serviceName,
      dockerImage,
      env,
    },
  });

  if (resp.status >= 400) {
    throw new Error("Failed to create a new deployment");
  }

  const data: components["schemas"]["deployment"] = resp.data as any;

  await octokit.rest.repos.createDeploymentStatus({
    repo,
    owner,
    deployment_id: data.id,
    // environment_url: `https://${deploymentDomain}`,
    environment: env as any,
    log_url: `https://github.com/${owner}/${repo}/actions/runs/${github.context.runId}`,
    state: "queued",
  });
}

main().catch(function (error) {
  core.setFailed(error.message);
  process.exit(1);
});
