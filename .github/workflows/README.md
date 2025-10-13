# GitHub Auto-Merge Workflows

This directory contains GitHub Actions workflows for automatically merging pull requests based on various conditions.

## Workflows

### 1. `auto-merge-pr.yml` - Basic Auto-Merge

A simple workflow that automatically merges pull requests when they meet basic conditions.

**Triggers:**

- Pull request opened, synchronized, or reopened
- Pull request review submitted
- Check suite completed

**Conditions for auto-merge:**

- PR is not a draft
- PR is mergeable and in clean state
- All checks pass

### 2. `auto-merge-advanced.yml` - Advanced Auto-Merge

A comprehensive workflow with additional safety checks and manual trigger capability.

**Features:**

- Manual trigger via workflow dispatch
- Detailed PR condition checking
- Wait for all checks to complete
- Comprehensive error handling and reporting
- Branch targeting validation
- Bot author detection (optional)

**Triggers:**

- All triggers from basic workflow
- Manual trigger with PR number input

## Configuration

### Auto-Merge Config (`auto-merge-config.yml`)

The advanced workflow can be configured using the `auto-merge-config.yml` file in the `.github` directory.

**Key settings:**

- `enabled`: Enable/disable auto-merge globally
- `allowed_branches`: Branches that can be auto-merged
- `blocked_branches`: Branches that cannot be auto-merged
- `required_checks`: Checks that must pass
- `min_approvals`: Minimum number of approvals required
- `merge_strategy`: How to merge (squash, merge, rebase)

## Usage

### Automatic Auto-Merge

1. Create a pull request targeting `main` or `master`
2. Ensure all required checks pass
3. The workflow will automatically merge the PR when conditions are met

### Manual Auto-Merge

1. Go to the Actions tab in your repository
2. Select "Advanced Auto Merge Pull Requests"
3. Click "Run workflow"
4. Enter the PR number you want to auto-merge
5. Click "Run workflow"

## Safety Features

### Basic Workflow

- Only merges non-draft PRs
- Waits for checks to complete
- Uses squash merge strategy
- Deletes source branch after merge

### Advanced Workflow

- Validates PR state and mergeability
- Checks target branch (main/master only)
- Waits for all checks to complete
- Validates check results
- Provides detailed feedback via PR comments
- Handles edge cases and errors gracefully

## Required Permissions

The workflows require the following permissions:

- `contents: write` - To merge PRs and delete branches
- `pull-requests: write` - To comment on PRs
- `checks: read` - To check CI status

## Customization

### Adding Custom Checks

Add your custom checks to the `required_checks` list in the config file:

```yaml
required_checks:
  - "build"
  - "test"
  - "lint"
  - "your-custom-check"
```

### Branch Protection

Configure branch protection rules in your repository settings to require:

- Status checks to pass
- Up-to-date branches
- Required reviews (if using min_approvals > 0)

### Notification

The workflows will comment on PRs with:

- Success messages when auto-merged
- Failure messages with reasons
- Pending messages when waiting for checks

## Troubleshooting

### Common Issues

1. **"PR is not mergeable"**

   - Check for merge conflicts
   - Ensure branch is up-to-date with target

2. **"Checks are still pending"**

   - Wait for CI to complete
   - Check if any checks are stuck

3. **"PR is still a draft"**

   - Mark PR as ready for review
   - Remove draft status

4. **"PR is not targeting main/master branch"**
   - Change target branch to main or master
   - Update workflow config if needed

### Debugging

Enable debug logging by adding this to your workflow:

```yaml
- name: Debug PR details
  run: |
    echo "PR State: ${{ steps.pr-details.outputs.pr_state }}"
    echo "Mergeable: ${{ steps.pr-details.outputs.pr_mergeable }}"
    echo "Mergeable State: ${{ steps.pr-details.outputs.pr_mergeable_state }}"
```

## Security Considerations

- The workflows use `GITHUB_TOKEN` which has limited permissions
- Consider using a personal access token for more control
- Review and test workflows before enabling on production repositories
- Consider requiring manual approval for sensitive changes

## Examples

### Simple Auto-Merge

```yaml
# Enable for all PRs to main
on:
  pull_request:
    branches: [main]
    types: [opened, synchronize]
```

### Conditional Auto-Merge

```yaml
# Only auto-merge specific types of changes
if: contains(github.event.pull_request.title, 'feat:') || contains(github.event.pull_request.title, 'fix:')
```

### Manual Override

```yaml
# Allow manual triggering
on:
  workflow_dispatch:
    inputs:
      pr_number:
        description: "PR number to merge"
        required: true
```
