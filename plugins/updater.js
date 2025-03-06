import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import AdmZip from 'adm-zip';
import config from '../config.cjs';

const HEROKU_APP_NAME = config.HEROKU_APP_NAME;
const HEROKU_API_KEY = config.HEROKU_API_KEY;

const update = async (m, Matrix) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';

  if (!['update', 'upgrade', 'sync'].includes(cmd)) return;
  if (m.sender !== config.OWNER_NUMBER) return Matrix.sendMessage(m.from, { text: 'This command is only for the bot owner.' }, { quoted: m });

  if (!HEROKU_APP_NAME || !HEROKU_API_KEY) {
    return Matrix.sendMessage(m.from, { text: '❌ Heroku API Key or App Name is missing in config.js.' }, { quoted: m });
  }

  try {
    await Matrix.sendMessage(m.from, { text: '🔍 Checking for JAWAD-MD updates...' }, { quoted: m });

    // Fetch latest commit hash
    const commitRes = await fetch('https://api.github.com/repos/JawadYTX/KHAN-MD/commits/main');
    const commitData = await commitRes.json();
    const latestCommitHash = commitData.sha;

    // Get current commit hash
    let currentHash = 'unknown';
    try {
      const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
      currentHash = packageJson.commitHash || 'unknown';
    } catch (error) {
      console.error('Error reading package.json:', error);
    }

    if (latestCommitHash === currentHash) {
      return Matrix.sendMessage(m.from, { text: '✅ Your JAWAD-MD bot is already up-to-date!' }, { quoted: m });
    }

    await Matrix.sendMessage(m.from, { text: '🚀 JAWAD-MD Bot Updating...' }, { quoted: m });

    // Download latest code
    const zipPath = path.join('./latest.zip');
    const zipRes = await fetch('https://github.com/JawadYTX/KHAN-MD/archive/main.zip');
    const zipBuffer = await zipRes.arrayBuffer();
    fs.writeFileSync(zipPath, Buffer.from(zipBuffer));

    await Matrix.sendMessage(m.from, { text: '📦 Extracting the latest code...' }, { quoted: m });

    // Extract ZIP
    const extractPath = path.join('./latest');
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);

    await Matrix.sendMessage(m.from, { text: '🔄 Replacing files...' }, { quoted: m });

    // Copy updated files (skip config.js & app.json)
    const sourcePath = path.join(extractPath, 'KHAN-MD-main');
    copyFolderSync(sourcePath, './');

    // Cleanup
    fs.unlinkSync(zipPath);
    fs.rmSync(extractPath, { recursive: true, force: true });

    // Deploy to Heroku
    await Matrix.sendMessage(m.from, { text: '🚀 Deploying update to Heroku...' }, { quoted: m });
    await deployToHeroku();

    await Matrix.sendMessage(m.from, { text: '✅ Update complete! Restarting bot...' }, { quoted: m });

    process.exit(0); // Restart bot
  } catch (error) {
    console.error('Update error:', error);
    Matrix.sendMessage(m.from, { text: '❌ Update failed. Please try manually.' }, { quoted: m });
  }
};

// Helper function to copy files, skipping config.js & app.json
function copyFolderSync(source, target) {
  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });

  const items = fs.readdirSync(source);
  for (const item of items) {
    const srcPath = path.join(source, item);
    const destPath = path.join(target, item);

    if (item === 'config.js' || item === 'app.json') {
      console.log(`Skipping ${item} to preserve custom settings.`);
      continue;
    }

    if (fs.lstatSync(srcPath).isDirectory()) {
      copyFolderSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Restart Heroku bot
async function deployToHeroku() {
  try {
    await fetch(`https://api.heroku.com/apps/${HEROKU_APP_NAME}/dynos`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.heroku+json; version=3',
        'Authorization': `Bearer ${HEROKU_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ command: 'restart' })
    });
    console.log('✅ Bot restarted on Heroku.');
  } catch (error) {
    console.error('❌ Failed to restart bot on Heroku:', error);
  }
}

export default update;
