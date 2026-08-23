# HomeChef Discord status reporting

`discord-status.yml` posts a concise status update whenever a change is pushed
to `master`. It uses the pushed commit subjects as the feature/update summary and
lists at most ten commits, so Discord stays readable.

## One-time setup

1. In GitHub, open this repository's **Settings**.
2. Go to **Secrets and variables** > **Actions**.
3. Create a repository secret named `DISCORD_WEBHOOK_URL`.
4. Paste the incoming-webhook URL for the HomeChef `#status-reports` channel.

The URL is a credential. Never commit it, add it to an Expo environment file,
or put it into issue or pull-request text.

## Manual update

In GitHub, open **Actions** > **Discord status update** > **Run workflow**.
Optionally enter a concise feature summary. The workflow will post it with the
same webhook, without requiring a repository change.
