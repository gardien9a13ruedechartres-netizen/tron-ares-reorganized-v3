const chokidar = require("chokidar");
const { exec } = require("child_process");

const SITE_FOLDER = __dirname;

let deployRunning = false;
let timeout = null;

function deploy() {

    if (deployRunning) {
        console.log("Déploiement déjà en cours...");
        return;
    }

    deployRunning = true;

    const command = `npx wrangler deploy`;

    console.log("");
    console.log("=================================");
    console.log("Déploiement Worker Cloudflare...");
    console.log("=================================");
    console.log("");

    exec(
        command,
        {
            cwd: SITE_FOLDER,
            shell: "cmd.exe"
        },
        (error, stdout, stderr) => {

            if (stdout) {
                console.log(stdout);
            }

            if (stderr) {
                console.error(stderr);
            }

            if (error) {
                console.error("Erreur :", error.message);
            } else {
                console.log("Déploiement terminé.");
            }

            deployRunning = false;
        }
    );
}

console.log("");
console.log("=================================");
console.log("Watcher Cloudflare actif");
console.log(SITE_FOLDER);
console.log("=================================");
console.log("");

const watcher = chokidar.watch(SITE_FOLDER, {
    ignored: [
        /(^|[\/\\])\../,
        /node_modules/,
        /\.git/,
        /\.wrangler/,
        /auto-deploy-cloudflare\.js/,
        /package-lock\.json/,
        /wrangler\.toml/,
        /worker\.js/,
        /generate-player\.js/,
       /\.assetsignore/
    ],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
    }
});

watcher.on("all", (event, filePath) => {

    console.log("");
    console.log("Changement détecté :", event);
    console.log(filePath);

    clearTimeout(timeout);

    timeout = setTimeout(() => {
        deploy();
    }, 3000);
});