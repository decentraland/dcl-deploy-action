import * as core from "@actions/core";
import * as github from "@actions/github";
import { components } from "@octokit/openapi-types";

async function main() {
  const ref = core.getInput("ref", { required: true });
  const sha = core.getInput("sha", { required: true });
  const deploymentDomain = core.getInput("deploymentDomain", { required: true, trimWhitespace: true });
  const deploymentName = core.getInput("deploymentName", { required: true, trimWhitespace: true });
  const packageName = core.getInput("packageName", { required: true, trimWhitespace: true });
  const packageVersion = core.getInput("packageVersion", { required: true, trimWhitespace: true });
  const token = core.getInput("token", { required: true });

  const octokit = github.getOctokit(token, {
    previews: ["ant-man-preview", "flash-preview"],
  });

  const { owner, repo } = github.context.repo;

  const resp = await octokit.rest.repos.createDeployment({
    owner,
    repo,
    ref,
    environment: deploymentDomain,
    description: `Progressive deployment: ${deploymentName} in ${deploymentDomain} at ${percentage}%`,
    auto_merge: false,
    required_contexts: [],
    // this task is handled by the webhooks-receiver
    task: "dcl/set-rollout",
    payload: {
      ref,
      sha,
      domain: deploymentDomain,
      prefix: packageName,
      version: packageVersion,
      rolloutName: deploymentName,
      percentage
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
    environment_url: `https://${deploymentDomain}`,
    log_url: `https://github.com/${owner}/${repo}/actions/runs/${github.context.runId}`,
    state: "queued",
  });
}

main().catch(function (error) {
  core.setFailed(error.message);
  process.exit(1);
});
