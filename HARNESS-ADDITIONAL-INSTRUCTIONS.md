1. never use radix-ui. use base-ui. if any implemented, refactor then QA. if not using radix / base, skip this line.

2. add pricing tier. i propose 4 tier with 1 tier is the base for trying out. i dont have any payment gateway yet, so make a package and mock real interfaces for it.

3. if havent, make it multi-tenant using better-auth. our user can have multi workspaces (for each client / projects / workspaces / organization). no need for multiple teams (better auth), only multi tenant. each user must have 1 workspace, cannot proceed if not have it.

4. never work on main branch. use `{feat|bugfix|release|hotfix}/*}` branches. open gh PR to main (use actual industry flow).

5. make sure elysiajs setted up for:
   a. openapi + scalar plugin (technical documentation. you propose to my right-hand for approval, whether it for public, private, or hybrid).
   b. opentelemetry.
   c. evlog.
   d. standardized envelope.
   e. helmet.

you can set them up as packages if it is complex enough / reusability concern / other aspects (you decide).

propose what you havent implemented from those points to my right-hand for approval.

6. always reindex @AGENTS.md periodically. (like 10 minutes or per epic).

7. force to fully setup & configured.

no need to handle empty / unconfigured (like github oauth, r2, and others), just stop OR continue.

stop if it is mandatory for user/human to provide it NOW. continue if it can be defered withouth any extra temporary implementation to pass it.

8. use t3 env for runtime env validations.
