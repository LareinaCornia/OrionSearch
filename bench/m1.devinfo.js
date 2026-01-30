const os = require('node:os');
const { execSync } = require('node:child_process');

function getDiskSizeGB() {
    try {
        const output = execSync('df -k /').toString().split('\n')[1];
        const blocks = output.trim().split(/\s+/)[1];
        return Math.round(Number(blocks) / 1024 / 1024);
    } catch {
        return null;
    }
}

const devInfo = {
    "cpu-no": os.cpus().length,
    "mem-gb": Math.round(os.totalmem() / 1024 / 1024 / 1024),
    "ssd-gb": getDiskSizeGB()
};

console.log(JSON.stringify(devInfo, null, 2));