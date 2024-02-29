const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

let verbose = false;

const checkAndInstallPackage = (packageName) => {
    try {
        require.resolve(packageName);
        if (verbose) logWithTimestamp(`${packageName} is already installed.`);
    } catch (e) {
        logWithTimestamp(`${packageName} is not installed. Installing...`);
        execSync(`npm install ${packageName}`, { stdio: 'inherit' });
    }
};

const logWithTimestamp = (message) => {
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    readline.cursorTo(process.stdout, 0, process.stdout.rows - (message.includes('Processing directory') ? 2 : 3));
    readline.clearLine(process.stdout, 0);
    console.log(`[${timestamp}] ${message}`);
    readline.cursorTo(process.stdout, 0);
};

const scanSiblingDirectories = () => {
    logWithTimestamp('Scanning sibling directories...');
    const currentFile = __filename;
    const parentDirectory = path.dirname(currentFile);
    let siblingDirectories = fs.readdirSync(parentDirectory, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory() && dirent.name !== 'node_modules' && path.join(parentDirectory, dirent.name) !== currentFile)
        .map(dirent => path.join(parentDirectory, dirent.name))
        .filter(directoryPath => fs.readdirSync(directoryPath).some(file => file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.cjs')));
    if (siblingDirectories.length === 0) {
        siblingDirectories = [parentDirectory];
    }
    logWithTimestamp('Scanning completed.');
    return siblingDirectories;
};

function checkAndInstallLibrary(libraryName) {
    const isInstalledGlobally = () => {
        try {
            execSync(`npm list -g ${libraryName}`, { stdio: 'ignore' });
            if (verbose) logWithTimestamp(`${libraryName} is already installed globally.`);
            return true;
        } catch {
            return false;
        }
    };

    if (!isInstalledGlobally()) {
        logWithTimestamp(`${libraryName} is not installed. Installing...`);
        execSync(`npm install -g ${libraryName}`, { stdio: 'inherit' });
    }
}
function processDirectory(directory, isRoot = true) {
    checkAndInstallPackage('progress');
    const ProgressBar = require('progress');
    let totalFiles = 0;
    const countFiles = (dir) => {
        fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
            if (entry.isDirectory() && entry.name !== 'node_modules') {
                countFiles(path.join(dir, entry.name));
            } else if ((entry.name.endsWith('.js') || entry.name.endsWith('.cjs') || entry.name.endsWith('.mjs')) && entry.name !== path.basename(__filename)) {
                totalFiles++;
            }
        });
    };
    countFiles(directory);
    readline.cursorTo(process.stdout, 0, 1);
    readline.clearLine(process.stdout, 0);
    const progressBar = new ProgressBar('[:bar] :current/:total Files Processed', {total: totalFiles, clear: true, width: process.stdout.columns });

    const processEntries = (dir) => {
        fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
            logWithTimestamp(`Processing directory: ${dir}`);
            progressBar.tick();
            if (entry.isDirectory() && entry.name !== 'node_modules') {
                processEntries(path.join(dir, entry.name));
            } else if ((entry.name.endsWith('.js') || entry.name.endsWith('.cjs') || entry.name.endsWith('.mjs')) && entry.name !== path.basename(__filename)) {
                const entryPath = path.join(dir, entry.name);
                try {
                    const fileContent = fs.readFileSync(entryPath, 'utf8');
                    logWithTimestamp(`Processing ${entryPath}...`);
                    if (isObfuscated(fileContent)) {
                        logWithTimestamp(`Deobfuscating ${entry.name}...`);
                        checkAndInstallLibrary('@wakaru/cli');
                        checkAndInstallLibrary('js-deobfuscator');
                        checkAndInstallLibrary('js-beautify');
                        checkAndInstallLibrary('restringer');
                        checkAndInstallLibrary('webcrack');
                        checkAndInstallLibrary('deobfuscator');

                        deobfuscateFile(entryPath);
                        logWithTimestamp(`${entry.name} has been deobfuscated and beautified.`);
                    } else {
                        logWithTimestamp(`${entryPath} is not obfuscated. Skipping...`);
                    }
                } catch (error) {
                    logWithTimestamp(`Failed to deobfuscate ${entry.name}: ${error}`);
                }
                if (progressBar.complete && isRoot) {
                    logWithTimestamp('\nAll files processed.');
                }
            }
        });
    };
    processEntries(directory);
}

const processDirectories = (directoriesToProcess) => {
    directoriesToProcess.forEach(dirPath => {
        if (!fs.existsSync(dirPath)) {
            logWithTimestamp(`Directory ${dirPath} does not exist.`);
            return;
        }
        if (fs.lstatSync(dirPath).isDirectory()) {
            processDirectory(dirPath, false);
        } else if (path.extname(dirPath) === '.js' || path.extname(dirPath) === '.cjs' || path.extname(dirPath) === '.mjs') {
            logWithTimestamp(`Processing file: ${dirPath}`);
            processDirectory(path.dirname(dirPath), false);
        } else {
            logWithTimestamp(`The path provided is not a directory or a supported file type.`);
        }
    });
};

const cleanupTempData = () => {
    logWithTimestamp('Cleaning up temporary data...');
    const recursiveDeleteOutputDir = (dir) => {
        fs.readdirSync(dir, { withFileTypes: true }).forEach(dirent => {
            const fullPath = path.join(dir, dirent.name);
            if (dirent.isDirectory()) {
                if (dirent.name === 'output_dir') {
                    fs.rmSync(fullPath, { recursive: true }, (err) => {
                        if (err) {
                            logWithTimestamp(`Error cleaning up output directory: ${fullPath}`, err);
                        } else {
                            logWithTimestamp(`Cleaned up output directory: ${fullPath}`);
                        }
                    });
                } else {
                    recursiveDeleteOutputDir(fullPath);
                }
            }
        });
    };

    recursiveDeleteOutputDir(process.cwd());
    logWithTimestamp("Temporary data cleaned up successfully.");
};

const isObfuscated = (content) => {
    const obfuscationDetector = 'obfuscation-detector';
    try {
        require.resolve(obfuscationDetector);
        if (verbose) logWithTimestamp(`${obfuscationDetector} is already installed.`);
    } catch (e) {
        logWithTimestamp(`${obfuscationDetector} is not installed. Installing...`);
        execSync(`npm install ${obfuscationDetector}`, { stdio: 'inherit' });
    }
    const detectObfuscation = require(obfuscationDetector);
    const mostLikelyObfuscationType = detectObfuscation(content);
    return mostLikelyObfuscationType !== null;
};
const deobfuscateFile = (entryPath) => {
    const tempPath = `${entryPath}.temp`;
    const outputDir = path.join(path.dirname(entryPath), 'output_dir');
    const steps = [
        { name: 'js-beautify', command: `js-beautify -f ${entryPath} -j -x --good-stuff -a -r` },
        { name: '@wakaru/cli unpacker', command: `npx @wakaru/cli unpacker ${entryPath} --output ${outputDir} --force` },
        { name: '@wakaru/cli unminify', command: `npx @wakaru/cli unminify ${entryPath} --output ${outputDir} --force` },
        { name: 'js-deobfuscator', command: `js-deobfuscator -i ${entryPath} -o ${entryPath}` },
        { name: 'restringer', command: `restringer ${entryPath} -o ${entryPath}` },
        { name: 'webcrack', command: `npx webcrack ${entryPath} -o ${tempPath} -f` },
        { name: 'synchrony deobfuscate', command: `synchrony deobfuscate ${entryPath} -o ${entryPath}.deobfuscated.js` },
        { name: 'js-beautify', command: `js-beautify -f ${entryPath} -j -x --good-stuff -a -r` }
    ];

    logWithTimestamp(`Deobfuscating file: ${entryPath}`);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    steps.forEach((step, index) => {
        try {
            logWithTimestamp(`Step ${index + 1}/${steps.length}: deobfuscate using ${step.name} started.`);
            execSync(step.command, { stdio: verbose ? 'inherit' : 'ignore' });
            logWithTimestamp(`Step ${index + 1}/${steps.length}: deobfuscate using ${step.name} completed.`);
        } catch (error) {
            logWithTimestamp(`Step ${index + 1}/${steps.length}: Error during deobfuscate using ${step.name}!`);
        }

        // Handle file movements and deletions
        if (step.name === 'synchrony deobfuscate') {
            const deobfuscatedFilePath = `${entryPath}.deobfuscated.js`;
            if (fs.existsSync(deobfuscatedFilePath)) {
                fs.unlinkSync(entryPath);
                fs.renameSync(deobfuscatedFilePath, entryPath);
            }
        } else if (step.name === 'webcrack' && fs.existsSync(tempPath) && fs.lstatSync(tempPath).isDirectory()) {
            const deobfuscatedFilePath = path.join(tempPath, 'deobfuscated.js');
            if (fs.existsSync(deobfuscatedFilePath)) {
                fs.unlinkSync(entryPath);
                fs.renameSync(deobfuscatedFilePath, entryPath);
                fs.rmSync(tempPath, { recursive: true });
            }
        } else if (fs.existsSync(tempPath)) {
            fs.unlinkSync(entryPath);
            fs.renameSync(tempPath, entryPath);
        } else if (step.name.includes('@wakaru/cli')) {
            const processedFilePath = path.join(outputDir, 'entry.js');
            if (fs.existsSync(processedFilePath)) {
                fs.unlinkSync(entryPath);
                fs.renameSync(processedFilePath, entryPath);
            }
        }
    });

    cleanupTempData();
    logWithTimestamp("Deobfuscation and cleanup completed successfully.");
};

function main() {
    checkAndInstallPackage('commander');
    const { program } = require('commander');

    program
      .name('DECRYPTEX')
      .description('Just crazy tool that trying to deobfuscate anything around it!')
      .version('1.0.0', '-v, --version', 'output the current version')
      .helpOption('-h, --help', 'display help for command')
      .option('-f, --file <path>', 'specify the file to decrypt')
      .option('-d, --dir <path>', 'specify the directory to process')
      .option('-V, --verbose', 'enable verbose output')
      .parse(process.argv);
    
    const options = program.opts();
    
    verbose = options.verbose;
    
    if (verbose) {
      console.log('Verbose mode enabled');
    }
    
    console.log(`
    ██████╗ ██████╗  ██████╗██████╗ ██╗   ██╗██████╗ ████████╗██████╗ ██╗  ██╗
    ██╔══██╗╚════██╗██╔════╝██╔══██╗╚██╗ ██╔╝██╔══██╗╚══██╔══╝╚════██╗╚██╗██╔╝
    ██║  ██║ █████╔╝██║     ██████╔╝ ╚████╔╝ ██████╔╝   ██║    █████╔╝ ╚███╔╝ 
    ██║  ██║ ╚═══██╗██║     ██╔══██╗  ╚██╔╝  ██╔═══╝    ██║    ╚═══██╗ ██╔██╗ 
    ██████╔╝██████╔╝╚██████╗██║  ██║   ██║   ██║        ██║   ██████╔╝██╔╝ ██╗
    ╚═════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚═╝        ╚═╝   ╚═════╝ ╚═╝  ╚═╝                                                                       
    Sponsored by Decryptex X BerkahKarya
    `);
    
    let directoriesToProcess = [];
    if (options.dir) {
        if (fs.lstatSync(options.dir).isDirectory()) {
            directoriesToProcess = [options.dir];
        } else {
            logWithTimestamp("The specified path is not a directory.");
            process.exit(1);
        }
    } else if (options.file) {
        if (fs.lstatSync(options.file).isFile()) {
            directoriesToProcess = [path.dirname(options.file)];
        } else {
            logWithTimestamp("The specified path is not a file.");
            process.exit(1);
        }
    } else {
        directoriesToProcess = scanSiblingDirectories();
        if (directoriesToProcess.length === 0) {
            logWithTimestamp("No directories to process.");
            process.exit(1);
        }
    }
    
    processDirectories(directoriesToProcess);
}

// Ensure cleanup is called on process exit or interruption
process.on('exit', cleanupTempData);
process.on('SIGINT', cleanupTempData);
process.on('SIGTERM', cleanupTempData);
process.on('uncaughtException', cleanupTempData);
main()
