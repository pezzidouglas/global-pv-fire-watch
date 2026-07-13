# Public publishing checklist

## Hosted dashboard

1. Pass the production build, data-integrity, security-header and rendered-page tests.
2. Create a new immutable hosted checkpoint and verify that deployment reaches `succeeded`.
3. Check the dashboard, `/methodology`, `/data-policy`, `/corrections`, `/robots.txt` and `/sitemap.xml`.
4. Change the site access policy to `public` only after the verified checkpoint is live.
5. Recheck the access policy from the hosting control plane.

## Public GitHub mirror

The Sites source repository is not a GitHub repository, so GitHub Actions do not run there. Create an empty public repository named `global-pv-fire-watch` under the intended GitHub account, then push this source tree to its `main` branch.

Before enabling the daily workflow:

- protect `main` and require a pull request;
- require the build/test check and one approving review for data updates;
- disable force pushes and branch deletion on `main`;
- set Actions workflow permissions to read by default and allow pull-request creation;
- keep Dependabot enabled for npm and GitHub Actions;
- verify that the first scheduled run opens a data-only bot pull request; and
- link the repository from the dashboard footer after its final public URL is known.

The workflow runs daily at 14:17 UTC. Network discovery and dependency execution happen with read-only repository permissions. A separate job accepts only validated JSON files and writes to an automation branch for review.
