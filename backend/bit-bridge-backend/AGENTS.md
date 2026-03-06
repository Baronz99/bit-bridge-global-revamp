# Backend Agent Rules (bit-bridge-backend)

This file defines the default production deployment behavior for this backend workspace.

## Production Deploy Protocol (Mandatory)

- App: `bitbridgeglobal`
- Source branch for deploy: `production`
- Target remote/ref: `heroku main`
- Canonical deploy command:
  - `git push heroku production:main`

## Do Not Use

- Do not use `git subtree push` for production deploys of this backend.
- Do not force-push (`--force`) to Heroku for normal deploys.
- Do not deploy from feature branches unless explicitly instructed.

## Required Verification

Run these before and after every production deploy:

1. Pre-check branch:
   - `git branch --show-current`
   - Must be `production`
2. Pre-check pending commits:
   - `git log --oneline heroku/main..production`
   - Review expected commits only
3. Deploy:
   - `git push heroku production:main`
4. Post-check release:
   - `heroku releases -a bitbridgeglobal -n 3`

## Preferred Command

Use the scripted flow:

- `powershell -ExecutionPolicy Bypass -File .\script\deploy_backend_prod.ps1`

