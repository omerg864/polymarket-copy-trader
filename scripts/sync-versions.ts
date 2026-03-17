import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function syncVersions() {
	const rootPkgPath = path.join(rootDir, 'package.json');
	const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
	const version = rootPkg.version;

	console.log(`🚀 Syncing version ${version} to all workspaces...`);

	const workspaces = rootPkg.workspaces || [];
	workspaces.forEach((workspace: string) => {
		const pkgPath = path.join(rootDir, workspace, 'package.json');
		if (fs.existsSync(pkgPath)) {
			const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
			if (pkg.version !== version) {
				pkg.version = version;
				fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, '\t') + '\n');
				console.log(`✅ Updated ${workspace}/package.json to ${version}`);
			} else {
				console.log(`ℹ️ ${workspace}/package.json is already at ${version}`);
			}
		} else {
			console.warn(`⚠️  Workspace ${workspace} does not have a package.json at ${pkgPath}`);
		}
	});

	console.log('✨ Version sync complete!');
}

syncVersions();
