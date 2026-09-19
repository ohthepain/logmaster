#!/usr/bin/env python3
"""Local release commands for Codex on the Mac Mini; not a remote shell endpoint."""
import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
RELEASES = ROOT / 'ios/build/releases'
CONFIG = ROOT / 'secrets/ios-release.json'
REPOSITORY = 'git@github.com:ohthepain/logmaster.git'
URLS = {'production': 'https://logmaster.live', 'staging': 'https://staging.logmaster.live'}


def commit_sha(value):
    if not re.fullmatch(r'[0-9a-f]{40}', value):
        raise argparse.ArgumentTypeError('use the full, lowercase 40-character commit SHA')
    return value


def release_id(value):
    if not re.fullmatch(r'\d{8}T\d{12}Z-[0-9a-f]{12}', value):
        raise argparse.ArgumentTypeError('invalid release ID; use the ID printed by build')
    return value


def configuration():
    if not CONFIG.is_file():
        raise ValueError('Create secrets/ios-release.json from scripts/ios-release.example.json; see docs/ios-builds-with-codex.md')
    if CONFIG.stat().st_mode & 0o077:
        raise ValueError('Run chmod 600 secrets/ios-release.json')
    return json.loads(CONFIG.read_text())


def run(args, cwd=ROOT, env=None, capture=False):
    # No shell interpolation. Tool logs stay on the Mini, not in the conversation.
    result = subprocess.run(args, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                            stdout=subprocess.PIPE if capture else None, check=True, text=True)
    return result.stdout.strip() if capture else None


def auth(config, required=False):
    account = config.get('app_store_connect')
    if not account:
        if required:
            raise ValueError('Configure the local App Store Connect API key before upload')
        return []
    key = Path(account['key_path']).expanduser()
    if not key.is_absolute() or not key.is_file() or key.stat().st_mode & 0o077:
        raise ValueError('App Store Connect key must be an absolute local file with mode 600')
    return ['-allowProvisioningUpdates', '-authenticationKeyPath', str(key),
            '-authenticationKeyID', account['key_id'], '-authenticationKeyIssuerID', account['issuer_id']]


def xcodebuild():
    developer = run(['/usr/bin/xcode-select', '-p'], capture=True)
    tool = Path(developer) / 'usr/bin/xcodebuild'
    if not tool.is_file():
        raise ValueError('Select the full Xcode installation with xcode-select')
    return str(tool)


def doctor(config):
    xcode = xcodebuild()
    print(run([xcode, '-version'], capture=True))
    for name in ('node', 'pnpm', 'git'):
        if not shutil.which(name):
            raise ValueError(f'{name} is missing from PATH')
    identities = run(['/usr/bin/security', 'find-identity', '-v', '-p', 'codesigning'], capture=True)
    for identity in ('Apple Development:', 'Apple Distribution:'):
        if identity not in identities:
            raise ValueError(f'{identity} identity unavailable. Check Keychain access outside the Codex sandbox.')
    print('Apple Development and Apple Distribution identities are available.')
    if not config.get('google_ios_client_id', '').endswith('.apps.googleusercontent.com'):
        raise ValueError('Configure google_ios_client_id for native Google Sign-In')
    auth(config)
    print('Local configuration is valid. Upload API key: ' + ('configured' if config.get('app_store_connect') else 'not configured (export only)'))
    print('Provisioning compatibility and noninteractive signing are verified by the first archive/export.')


def build_environment(config, target):
    # Keep only OS/toolchain essentials; do not pass backend credentials or SSH agents.
    env = {key: os.environ[key] for key in ('HOME', 'USER', 'LOGNAME', 'PATH', 'TMPDIR') if key in os.environ}
    env.update(CI='1', LANG='en_US.UTF-8', GIT_TERMINAL_PROMPT='0',
               DATABASE_URL='postgresql://localhost:5432/dummy',
               GOOGLE_IOS_CLIENT_ID=config['google_ios_client_id'],
               CAP_REMOTE_APP_URL=URLS[target], COREPACK_ENABLE_PROJECT_SPEC='0')
    return env


def save(path, data):
    temporary = path.with_suffix('.tmp')
    with temporary.open('w') as output:
        json.dump(data, output, indent=2)
        output.write('\n')
        output.flush()
        os.fsync(output.fileno())
    temporary.replace(path)


def export_options(config):
    return {'method': 'app-store-connect', 'destination': 'export',
            'signingStyle': 'manual', 'signingCertificate': 'Apple Distribution',
            'teamID': 'RPGSNMH65P', 'manageAppVersionAndBuildNumber': False,
            'uploadSymbols': True, 'provisioningProfiles': {
                'live.logmaster.app': config.get('app_profile', 'Logmaster Distribution'),
                'live.logmaster.app.widgets': config.get('widget_profile', 'Logmaster Widgets Distribution')}}


def build(config, commit, target):
    doctor(config)
    identifier = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '-' + commit[:12]
    directory = RELEASES / identifier
    directory.mkdir(mode=0o700)
    manifest = {'release': identifier, 'commit': commit, 'environment': target, 'state': 'building'}
    save(directory / 'release.json', manifest)
    print(f'Release: {identifier}\nLocal log: {directory / "build.log"}', flush=True)
    # Redirect all build output, including failures, to a local log. No .p8 contents read.
    with (directory / 'build.log').open('w') as log:
        source = directory / 'source'
        env = build_environment(config, target)

        def execute(args, cwd=source, capture=False, command_env=None):
            result = subprocess.run(args, cwd=cwd, env=env if command_env is None else command_env, stdin=subprocess.DEVNULL,
                                    stdout=subprocess.PIPE if capture else log, stderr=log,
                                    check=True, text=True)
            return result.stdout.strip() if capture else None

        try:
            git = ['/usr/bin/git', '-c', 'core.hooksPath=/dev/null']
            execute([*git, 'init', '--template=', str(source)], directory)
            # Only the fixed-repository fetch may use the host's SSH agent.
            # Never expose it to dependency scripts, checkout hooks or Xcode.
            fetch_env = env.copy()
            if os.environ.get('SSH_AUTH_SOCK'):
                fetch_env['SSH_AUTH_SOCK'] = os.environ['SSH_AUTH_SOCK']
            execute([*git, 'fetch', '--no-tags', '--no-recurse-submodules', '--depth=1', REPOSITORY, commit],
                    command_env=fetch_env)
            actual = execute([*git, 'rev-parse', 'FETCH_HEAD^{commit}'], capture=True)
            if actual != commit:
                raise ValueError('fetched commit does not match the requested SHA')
            execute([*git, 'checkout', '--detach', commit])
            project = source / 'ios/App/App.xcodeproj/project.pbxproj'
            text = project.read_text()
            versions = [int(v) for v in re.findall(r'CURRENT_PROJECT_VERSION = (\d+);', text)]
            if not versions:
                raise ValueError('No iOS build number found')
            counter = RELEASES / 'build-number.json'
            previous = json.loads(counter.read_text()) if counter.exists() else 0
            number = max(previous, config.get('last_build_number', 0), *versions) + 1
            save(counter, number)  # Reserve even if this build fails.
            manifest['build_number'] = number
            project.write_text(re.sub(r'CURRENT_PROJECT_VERSION = \d+;', f'CURRENT_PROJECT_VERSION = {number};', text))
            execute(['pnpm', 'install', '--frozen-lockfile'])
            execute(['node', 'scripts/prepare-capacitor.mjs'])
            execute(['pnpm', 'exec', 'cap', 'sync', 'ios'])
            execute(['node', 'scripts/sync-app-icons.mjs'])
            execute(['node', 'scripts/configure-google-sign-in-ios.mjs'])
            xcode = xcodebuild()
            execute([xcode, '-project', str(project.parent), '-scheme', 'Logbook2.0',
                     '-configuration', 'Release', '-destination', 'generic/platform=iOS',
                     '-archivePath', str(directory / 'Logmaster.xcarchive'),
                     '-derivedDataPath', str(directory / 'DerivedData'),
                     '-onlyUsePackageVersionsFromResolvedFile',
                     'DEVELOPMENT_TEAM=RPGSNMH65P', f'CURRENT_PROJECT_VERSION={number}',
                     *auth(config), 'archive'])
            options = directory / 'ExportOptions.plist'
            options.write_bytes(plistlib.dumps(export_options(config)))
            execute([xcode, '-exportArchive', '-archivePath', str(directory / 'Logmaster.xcarchive'),
                     '-exportPath', str(directory / 'export'), '-exportOptionsPlist', str(options), *auth(config)])
            ipas = list((directory / 'export').glob('*.ipa'))
            if len(ipas) != 1:
                raise ValueError('expected exactly one exported IPA')
            digest = hashlib.sha256()
            with ipas[0].open('rb') as ipa:
                for chunk in iter(lambda: ipa.read(1024 * 1024), b''):
                    digest.update(chunk)
            manifest.update(state='exported', ipa=str(ipas[0].relative_to(directory)), ipa_sha256=digest.hexdigest())
        except BaseException:
            manifest['state'] = 'failed'
            raise
        finally:
            save(directory / 'release.json', manifest)
    print(json.dumps(manifest, indent=2))


def upload(config, identifier):
    authentication = auth(config, required=True)
    directory = RELEASES / identifier
    manifest = json.loads((directory / 'release.json').read_text())
    if manifest['state'] != 'exported':
        raise ValueError('release must be exported and not previously uploaded; inspect release.json')
    # Upload the existing archive; do not rebuild or increment its version.
    options = plistlib.loads((directory / 'ExportOptions.plist').read_bytes())
    options['destination'] = 'upload'
    upload_options = directory / 'UploadOptions.plist'
    upload_options.write_bytes(plistlib.dumps(options))
    manifest['state'] = 'uploading'
    save(directory / 'release.json', manifest)
    try:
        with (directory / 'upload.log').open('w') as log:
            subprocess.run([xcodebuild(), '-exportArchive', '-archivePath', str(directory / 'Logmaster.xcarchive'),
                            '-exportPath', str(directory / 'upload'), '-exportOptionsPlist', str(upload_options),
                            *authentication], cwd=directory, stdin=subprocess.DEVNULL, stdout=log, stderr=log, check=True,
                           env=build_environment(config, manifest['environment']))
    except BaseException:
        # Never retry an ambiguous upload automatically: Apple may have received it.
        manifest['state'] = 'upload-needs-review'
        save(directory / 'release.json', manifest)
        raise
    manifest['state'] = 'uploaded'
    save(directory / 'release.json', manifest)
    print('Uploaded archive to App Store Connect. Apple processing/TestFlight availability is still pending.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    actions = parser.add_subparsers(dest='action', required=True)
    actions.add_parser('doctor')
    build_parser = actions.add_parser('build')
    build_parser.add_argument('commit', type=commit_sha)
    build_parser.add_argument('--environment', choices=URLS, default='production')
    upload_parser = actions.add_parser('upload')
    upload_parser.add_argument('release', type=release_id)
    args = parser.parse_args()
    os.umask(0o077)
    config = configuration()
    if args.action == 'doctor':
        doctor(config)
        return
    RELEASES.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (RELEASES / 'release.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError('another iOS build/upload is running') from None
        if args.action == 'build':
            build(config, args.commit, args.environment)
        else:
            upload(config, args.release)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        # CalledProcessError includes argv (potentially credential paths); keep it local.
        print('iOS release failed. Inspect the local build/upload log.' if isinstance(error, subprocess.CalledProcessError)
              else str(error), file=sys.stderr)
        sys.exit(1)
