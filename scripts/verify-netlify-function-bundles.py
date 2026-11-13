"""Inspect deploy-ready ZIPs without extracting or executing their contents."""
import hashlib
import json
import pathlib
import posixpath
import re
import sys
import zipfile


class Rejected(Exception):
    pass


def require(condition, code):
    if not condition:
        raise Rejected(code)


def read_json(archive, name):
    require(name in archive.namelist(), 'RUNTIME_FILE_MISSING')
    require(archive.getinfo(name).file_size <= 2_000_000, 'RUNTIME_FILE_TOO_LARGE')
    return json.loads(archive.read(name))


def inspect(functions, root):
    functions, root = pathlib.Path(functions).resolve(), pathlib.Path(root).resolve()
    # FUNCTIONS_DIST is an explicit provider constant and may be outside the
    # checkout. Only ZIPs inside that exact resolved output are inspected.
    paths = sorted(functions.glob('*.zip'))
    require(1 <= len(paths) <= 32, 'BUNDLE_COUNT_INVALID')
    server = '___netlify-server-handler'
    manifest_path = root / '.netlify/functions-internal' / server / (server + '.json')
    require(manifest_path.is_file() and manifest_path.stat().st_size <= 2_000_000, 'HANDLER_MANIFEST_MISSING')
    manifest = json.loads(manifest_path.read_text())
    require(manifest.get('version') == 1 and manifest.get('config', {}).get('nodeBundler') == 'none', 'HANDLER_BUNDLER_CHANGED')
    summaries = []
    found_server = False
    for file in paths:
        require(file.resolve().is_relative_to(functions) and file.stat().st_size <= 256_000_000, 'BUNDLE_FILE_INVALID')
        with zipfile.ZipFile(file) as archive:
            entries = archive.infolist()
            require(1 <= len(entries) <= 100_000, 'ENTRY_COUNT_INVALID')
            require(sum(entry.file_size for entry in entries) <= 1_000_000_000, 'BUNDLE_EXPANSION_INVALID')
            names = [entry.filename for entry in entries]
            require(len(names) == len(set(names)), 'DUPLICATE_ENTRY')
            for name in names:
                parts = name.rstrip('/').split('/')
                require(not name.startswith('/') and '\\' not in name and not any(part in ('', '.', '..') for part in parts)
                        and not re.search(r'[\x00-\x1f\x7f]', name), 'UNSAFE_ENTRY_PATH')
                require(not any(part.lower() in ('.git', '.local', '.aws', '.ssh', '.npmrc', 'backups')
                                or part.lower().startswith('.env') or re.search(r'\.(pem|key|p12|pfx)$', part, re.I)
                                or re.search(r'^(service[-_]account|credentials).*\.json$', part, re.I) for part in parts), 'PRIVATE_ENTRY')
                # Unix symlinks must also stay inside the archive; no extraction.
                entry = archive.getinfo(name)
                if (entry.external_attr >> 16) & 0o170000 == 0o120000:
                    require(entry.file_size <= 4096, 'UNSAFE_SYMLINK')
                    target = archive.read(name).decode()
                    resolved = posixpath.normpath(posixpath.join(posixpath.dirname(name), target))
                    require(not target.startswith('/') and not resolved.startswith('../') and resolved in names, 'UNSAFE_SYMLINK')
            require(archive.testzip() is None, 'ZIP_INTEGRITY_FAILED')
            is_server = file.stem == server
            if is_server:
                found_server = True
                entrypoint = server + '.mjs'
                require(entrypoint in names and archive.getinfo(entrypoint).file_size <= 2_000_000, 'HANDLER_ENTRY_MISSING')
                entry_source = archive.read(entrypoint).decode()
                imports = re.findall(r"(?:from\s*|import\(\s*)['\"](\.[^'\"]+)['\"]", entry_source)
                require(len(imports) >= 3 and all(posixpath.normpath(value) in names for value in imports), 'HANDLER_IMPORT_MISSING')
                config = read_json(archive, 'run-config.json').get('nextConfig', {})
                required = read_json(archive, '.next/required-server-files.json')
                require(config.get('distDir') == '.next' and '.next/BUILD_ID' in names, 'RUNTIME_LAYOUT_INVALID')
                trace_root = required.get('config', {}).get('outputFileTracingRoot') or required.get('config', {}).get('experimental', {}).get('outputFileTracingRoot')
                require(required.get('relativeAppDir') == '' and required.get('appDir') == str(root)
                        and trace_root == str(root), 'TRACING_ROOT_MISMATCH')
                for required_module in ('.netlify/dist/run/handlers/server.js', '.netlify/dist/run/handlers/request-context.cjs', '.netlify/dist/run/handlers/tracer.cjs'):
                    require(required_module in names, 'HANDLER_MODULE_MISSING')
            with file.open('rb') as stream:
                digest = hashlib.file_digest(stream, 'sha256').hexdigest()
            summaries.append({'kind': 'NEXT_SERVER' if is_server else 'APPLICATION', 'sha256': digest, 'bytes': file.stat().st_size, 'entries': len(entries)})
    require(found_server, 'SERVER_BUNDLE_MISSING')
    return {'passed': True, 'bundles': summaries, 'rootLayout': True, 'nodeBundlerNone': True, 'privateEntries': 0}


def main():
    try:
        require(len(sys.argv) == 3, 'ARGUMENTS_INVALID')
        value = inspect(sys.argv[1], sys.argv[2])
    except Rejected as error:
        value = {'passed': False, 'code': str(error)}
    except Exception:
        # Never expose filenames, JSON/ZIP contents, environment or exceptions.
        value = {'passed': False, 'code': 'BUNDLE_INSPECTION_FAILED'}
    print(json.dumps(value, separators=(',', ':')))
    return 0 if value['passed'] else 1


if __name__ == '__main__':
    sys.exit(main())
