"""Run the exact bundled BrandBuilder recovery verifiers against the imported kit."""

import hashlib
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path


root = Path(__file__).resolve().parent.parent
if sys.platform == 'win32':
    raise SystemExit('Run the BrandBuilder recovery verifier in the approved Linux environment')
brand = root / 'brand'
contract = json.loads((brand / 'enforcement/consumer-contract.json').read_text(encoding='utf-8'))
recovery = contract['recovery']
archive_path = brand / recovery['path']
archive_bytes = archive_path.read_bytes()
if hashlib.sha256(archive_bytes).hexdigest() != recovery['sha256']:
    raise SystemExit('Bundled BrandBuilder recovery checksum mismatch')

with tempfile.TemporaryDirectory(prefix='glitchpad-brandbuilder-') as directory:
    verification_brand = Path(directory) / 'brand'
    shutil.copytree(brand, verification_brand)
    # Keep the recovery source outside the kit so the kit's prose audit checks
    # only delivered consumer files, not the verifier's own SKILL.md.
    extraction_root = Path(directory) / 'brandbuilder'
    extraction_root.mkdir()
    with zipfile.ZipFile(archive_path) as archive:
        for member in archive.infolist():
            path = Path(member.filename)
            mode = member.external_attr >> 16
            if path.is_absolute() or '..' in path.parts or ':' in member.filename or '\\' in member.filename or stat.S_ISLNK(mode):
                raise SystemExit(f'Unsafe BrandBuilder recovery member: {member.filename}')
        archive.extractall(extraction_root)
    renderer_environment = os.environ.copy()
    renderer_environment['CI'] = '1'
    subprocess.run(
        [
            'npm', 'install', '--prefix', str(extraction_root / 'templates'),
            '--no-save', '--no-package-lock', '--no-audit', '--no-fund',
            '@resvg/resvg-js@2.6.2',
        ],
        check=True,
        stdin=subprocess.DEVNULL,
        env=renderer_environment,
    )
    for script, argument in (
        ('verify.py', '.'),
        ('validate_glyph.py', 'brand.json'),
    ):
        command = [sys.executable, str(extraction_root / 'templates' / script), argument]
        completed = subprocess.run(
            command,
            cwd=verification_brand,
            check=False,
            stdin=subprocess.DEVNULL,
            env=renderer_environment,
        )
        if completed.returncode:
            raise SystemExit(f'{script} failed with exit code {completed.returncode}')
