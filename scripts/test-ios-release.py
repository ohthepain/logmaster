"""Focused release orchestration tests; no Xcode, signing or network access."""
import argparse
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import plistlib
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('ios_release', Path(__file__).with_name('ios-release.py'))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
SHA = 'a' * 40


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.releases = self.root / 'releases'
        self.releases.mkdir()
        self.config = {'google_ios_client_id': 'test.apps.googleusercontent.com', 'last_build_number': 71}
        self.calls = []
        self.location = patch.object(release, 'RELEASES', self.releases)
        self.location.start()
        self.addCleanup(self.location.stop)
        self.addCleanup(self.temp.cleanup)

    def fake_run(self, args, **kwargs):
        self.calls.append((args, kwargs))
        cwd = Path(kwargs['cwd'])
        output = ''
        if 'init' in args:
            Path(args[-1]).mkdir()
        if 'rev-parse' in args:
            output = SHA
        if 'checkout' in args:
            project = cwd / 'ios/App/App.xcodeproj/project.pbxproj'
            project.parent.mkdir(parents=True)
            project.write_text('CURRENT_PROJECT_VERSION = 55;\nCURRENT_PROJECT_VERSION = 55;')
        if '-exportArchive' in args:
            export = Path(args[args.index('-exportPath') + 1])
            export.mkdir()
            (export / 'Logmaster.ipa').write_bytes(b'test ipa')
        return subprocess.CompletedProcess(args, 0, stdout=output)

    def build(self):
        with patch.object(release, 'doctor'), patch.object(release, 'xcodebuild', return_value='/xcodebuild'), \
                patch.object(release.subprocess, 'run', side_effect=self.fake_run), contextlib.redirect_stdout(io.StringIO()):
            release.build(self.config, SHA, 'production')
        return next(self.releases.glob('*/release.json'))

    def test_rejects_refs_shell_text_and_paths(self):
        for invalid in ['main', 'a' * 39, 'A' * 40, SHA + ';id', SHA + '\n', '../../x']:
            with self.assertRaises(argparse.ArgumentTypeError):
                release.commit_sha(invalid)
        for invalid in ['../archive', '/tmp/a', '20260917T120000Z-' + 'a' * 12]:
            with self.assertRaises(argparse.ArgumentTypeError):
                release.release_id(invalid)
        self.assertEqual(release.commit_sha(SHA), SHA)

    def test_build_fetches_exact_commit_exports_without_upload_and_versions_both_targets(self):
        path = self.build()
        manifest = json.loads(path.read_text())
        self.assertEqual(manifest['state'], 'exported')
        self.assertEqual(manifest['build_number'], 72)
        self.assertEqual(manifest['commit'], SHA)
        release.release_id(manifest['release'])
        project = path.parent / 'source/ios/App/App.xcodeproj/project.pbxproj'
        self.assertEqual(project.read_text().count('CURRENT_PROJECT_VERSION = 72;'), 2)
        fetch = next(args for args, _ in self.calls if 'fetch' in args)
        self.assertEqual(fetch[-2:], [release.REPOSITORY, SHA])
        exports = [args for args, _ in self.calls if '-exportArchive' in args]
        self.assertEqual(len(exports), 1)
        options = plistlib.loads((path.parent / 'ExportOptions.plist').read_bytes())
        self.assertEqual(options['destination'], 'export')
        self.assertFalse(options['manageAppVersionAndBuildNumber'])
        self.assertIn('live.logmaster.app.widgets', options['provisioningProfiles'])
        self.assertEqual(len(manifest['ipa_sha256']), 64)

    def test_build_numbers_increase_across_fresh_checkouts(self):
        self.build()
        self.build()
        self.assertEqual(json.loads((self.releases / 'build-number.json').read_text()), 73)

    def test_failed_fetch_cannot_proceed_to_dependency_install_or_archive(self):
        def fail(args, **kwargs):
            if 'fetch' in args:
                raise subprocess.CalledProcessError(1, args)
            return self.fake_run(args, **kwargs)
        with patch.object(release, 'doctor'), patch.object(release.subprocess, 'run', side_effect=fail), \
                contextlib.redirect_stdout(io.StringIO()), self.assertRaises(subprocess.CalledProcessError):
            release.build(self.config, SHA, 'production')
        self.assertFalse(any(args[0] in ('pnpm', '/xcodebuild') for args, _ in self.calls))
        self.assertEqual(json.loads(next(self.releases.glob('*/release.json')).read_text())['state'], 'failed')

    def test_build_environment_drops_unrelated_credentials_and_injection_settings(self):
        with patch.dict(os.environ, {'AWS_SECRET_ACCESS_KEY': 'secret', 'NODE_OPTIONS': '--require evil',
                                    'CAP_DEV_SERVER_URL': 'http://evil', 'SSH_AUTH_SOCK': '/evil'}):
            env = release.build_environment(self.config, 'production')
        for key in ('AWS_SECRET_ACCESS_KEY', 'NODE_OPTIONS', 'CAP_DEV_SERVER_URL', 'SSH_AUTH_SOCK'):
            self.assertNotIn(key, env)
        self.assertEqual(env['CAP_REMOTE_APP_URL'], 'https://logmaster.live')

    def test_only_fixed_repository_fetch_receives_ssh_agent(self):
        with patch.dict(os.environ, {'SSH_AUTH_SOCK': '/local/agent', 'AWS_SECRET_ACCESS_KEY': 'secret'}):
            self.build()
        for args, kwargs in self.calls:
            env = kwargs['env']
            self.assertNotIn('AWS_SECRET_ACCESS_KEY', env)
            if 'fetch' in args:
                self.assertEqual(args[-2:], [release.REPOSITORY, SHA])
                self.assertEqual(env['SSH_AUTH_SOCK'], '/local/agent')
            else:
                self.assertNotIn('SSH_AUTH_SOCK', env)

    def test_fetched_sha_mismatch_stops_before_checkout(self):
        def mismatch(args, **kwargs):
            result = self.fake_run(args, **kwargs)
            if 'rev-parse' in args:
                result.stdout = 'b' * 40
            return result
        with patch.object(release, 'doctor'), patch.object(release.subprocess, 'run', side_effect=mismatch), \
                contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(ValueError, 'does not match'):
            release.build(self.config, SHA, 'production')
        self.assertFalse(any('checkout' in args for args, _ in self.calls))

    def test_upload_requires_local_key(self):
        with self.assertRaisesRegex(ValueError, 'API key'):
            release.upload(self.config, '20260917T120000000000Z-' + 'a' * 12)

    def test_upload_uses_existing_archive_and_rejects_duplicate(self):
        path = self.build()
        identifier = path.parent.name
        self.calls.clear()
        with patch.object(release, 'auth', return_value=['-authenticationKeyPath', '/local/key.p8']), \
                patch.object(release, 'xcodebuild', return_value='/xcodebuild'), \
                patch.object(release.subprocess, 'run', side_effect=self.fake_run), contextlib.redirect_stdout(io.StringIO()):
            release.upload(self.config, identifier)
            with self.assertRaises(ValueError):
                release.upload(self.config, identifier)
        self.assertEqual(len(self.calls), 1)
        self.assertIn(str(path.parent / 'Logmaster.xcarchive'), self.calls[0][0])
        self.assertEqual(json.loads(path.read_text())['state'], 'uploaded')
        self.assertEqual(plistlib.loads((path.parent / 'UploadOptions.plist').read_bytes())['destination'], 'upload')

    def test_failed_upload_requires_local_review_before_retry(self):
        path = self.build()
        with patch.object(release, 'auth', return_value=[]), \
                patch.object(release, 'xcodebuild', return_value='/xcodebuild'), \
                patch.object(release.subprocess, 'run', side_effect=subprocess.CalledProcessError(1, ['xcodebuild'])), \
                self.assertRaises(subprocess.CalledProcessError):
            release.upload(self.config, path.parent.name)
        self.assertEqual(json.loads(path.read_text())['state'], 'upload-needs-review')


if __name__ == '__main__':
    unittest.main()
