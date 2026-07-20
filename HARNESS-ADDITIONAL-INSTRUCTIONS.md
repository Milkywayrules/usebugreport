1. never use radix-ui. use base-ui. if any implemented, refactor then QA. if not using radix / base, skip this line.

2. add pricing tier. i propose 4 tier with 1 tier is the base for trying out.

3. if havent, make it multi-tenant using better-auth. our user can have multi workspaces (for each client / projects / workspaces / organization). no need for multiple teams (better auth), only multi tenant. each user must have 1 workspace, cannot proceed if not have it.

4. never work on main branch. use `{feat|bugfix|release|hotfix}/*}` branches. open gh PR to main (use actual industry flow).
