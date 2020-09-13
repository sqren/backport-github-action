import * as core from '@actions/core';
import * as backport from 'backport';
import { EventPayloads } from '@octokit/webhooks';
import { getBackportConfig } from './getBackportConfig';
import { addPullRequestComment } from './addPullRequestComment';
import { exec } from '@actions/exec';
import { Context } from '@actions/github/lib/context';

export async function main(
  payload: EventPayloads.WebhookPayloadPullRequest,
  actor: Context['actor']
) {
  console.log(JSON.stringify(payload));
  if (!payload.pull_request) {
    throw new Error('Pull request payload unavailable');
  }

  await exec(`git config --global user.name "${actor}"`);
  await exec(
    `git config --global user.email "github-action-${actor}@users.noreply.github.com"`
  );

  // ignore anything but merged PRs
  const isMerged = payload.pull_request.merged;
  if (!isMerged) {
    console.log('PR not merged yet...');
    return;
  }

  // Inputs
  const accessToken = core.getInput('access_token', { required: true });
  const backportByLabel = core.getInput('backport_by_label', {
    required: false,
  });
  const prTitle = core.getInput('pr_title', {
    required: false,
  });
  const targetPRLabels = core.getInput('target_pr_labels', {
    required: false,
  });
  // TODO:
  // const backportByComment = core.getInput('backport_by_comment', {
  //   required: false,
  // });

  const username = payload.pull_request.user.login;
  const config = await getBackportConfig({
    payload,
    username,
    accessToken,
    backportByLabel,
    prTitle,
    targetPRLabels,
  });

  console.log('Config', config);

  if (!config.upstream) {
    throw new Error('Missing upstream');
  }

  if (!config.pullNumber) {
    throw new Error('Missing pull request number');
  }

  if (!config.branchLabelMapping) {
    throw new Error('Missing required `branchLabelMapping`');
  }

  const backportResponse = await backport.run(config);

  await addPullRequestComment({
    upstream: config.upstream,
    pullNumber: config.pullNumber,
    accessToken,
    backportResponse,
  });
}