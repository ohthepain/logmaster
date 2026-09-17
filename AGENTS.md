# Logmaster iOS releases

For iOS release work through the user's existing remote Codex connection, use
`docs/ios-builds-with-codex.md` and `pnpm ios:release`. The task runs on the Mac Mini;
do not add a GitHub self-hosted runner, remote shell endpoint, or another SSH
service for this workflow.

- Use the full user-selected commit SHA. Resolve a user-named branch to its exact
  current SHA before building. The helper builds a separate checkout.
- Run `pnpm ios:release doctor` to check tools and local signing access. Request
  the normal sandbox escalation when necessary; do not disable security controls.
- Export by default. Use the separate `upload RELEASE_ID` command only when the
  user has requested upload in the current task; do not ask again if authorized.
- Keep signing keys in Keychain and the App Store Connect `.p8` on the Mini.
  Never print/read private key contents into tool output, copy credentials into
  a checkout, or add them to GitHub. Local configuration is in the Git-ignored
  `secrets/ios-release.json`; inspect individual non-secret fields if needed.
- Summarize build failures using the relevant local log excerpt, checking for
  sensitive values before including it. Report the commit, build number, artifact
  paths and whether upload actually succeeded. Do not equate upload with Apple
  processing, TestFlight availability, or App Review submission.
