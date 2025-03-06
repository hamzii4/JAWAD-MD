import axios from "axios";
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import config from "../config.cjs";

const update = async (m, Matrix, isCreator) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(" ")[0].toLowerCase() : "";

  // Check if the command matches
  if (!["update", "up", "sync"].includes(cmd)) return;

  // Restrict command to the bot owner
  if (!isCreator) {
    await Matrix.sendMessage(m.from, { text: "*📛 THIS IS AN OWNER COMMAND*" }, { quoted: m });
    return;
  }

  if (!config.HEROKU_APP_NAME || !config.HEROKU_API_KEY) {
    return Matrix.sendMessage(m.from, { text: "❌ *Heroku API Key or App Name is missing in config.cjs.*" }, { quoted: m });
  }

  try {
    await Matrix.sendMessage(m.from, { text: "```🔍 Checking for KHAN-MD updates...```" }, { quoted: m });

    // Get the latest commit from GitHub
    const { data: commitData } = await axios.get("https://api.github.com/repos/JawadYTX/KHAN-MD/commits/main");
    const latestCommitHash = commitData.sha;

    // Get the current commit hash from package.json
    let currentHash = "unknown";
    try {
      const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
      currentHash = packageJson.commitHash || "unknown";
    } catch (error) {
      console.error("Error reading package.json:", error);
    }

    if (latestCommitHash === currentHash) {
      return Matrix.sendMessage(m.from, { text: "```✅ Your KHAN-MD bot is already up-to-date!```" }, { quoted: m });
    }

    await Matrix.sendMessage(m.from, { text: "```KHAN-MD Bot Updating...🚀```" }, { quoted: m });

    // Download the latest code
    const zipPath = path.join("latest.zip");
    const { data: zipData } = await axios.get(
      "https://github.com/JawadYTX/KHAN-MD/archive/main.zip",
      { responseType: "arraybuffer" }
    );
    fs.writeFileSync(zipPath, zipData);

    await Matrix.sendMessage(m.from, { text: "```📦 Extracting the latest code...```" }, { quoted: m });

    // Extract ZIP file
    const extractPath = path.join("latest");
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);

    await Matrix.sendMessage(m.from, { text: "```🔄 Replacing files...```" }, { quoted: m });

    // Copy updated files, skipping config.js and app.json
    const sourcePath = path.join(extractPath, "KHAN-MD-main");
    const destinationPath = path.join(".");
    copyFolderSync(sourcePath, destinationPath);

    // Cleanup
    fs.unlinkSync(zipPath);
    fs.rmSync(extractPath, { recursive: true, force: true });

    // Deploy to Heroku
    await Matrix.sendMessage(m.from, { text: "```🚀 Deploying update to Heroku...```" }, { quoted: m });
    await deployToHeroku();

    await Matrix.sendMessage(m.from, { text: "```✅ Update complete! Restarting bot...```" }, { quoted: m });
  } catch (error) {
    console.error("Update error:", error);
    Matrix.sendMessage(m.from, { text: "❌ Update failed. Please try manually." }, { quoted: m });
  }
};

// Helper function to copy directories while skipping config.js and app.json
function copyFolderSync(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const items = fs.readdirSync(source);
  for (const item of items) {
    const srcPath = path.join(source, item);
    const destPath = path.join(target, item);

    // Skip config.js and app.json to preserve custom settings
    if (item === "config.cjs" || item === "app.json") {
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

// Deploy bot to Heroku
async function deployToHeroku() {
  try {
    await axios.post(
      `https://api.heroku.com/apps/${config.HEROKU_APP_NAME}/dynos`,
      { command: "restart" },
      {
        headers: {
          "Accept": "application/vnd.heroku+json; version=3",
          "Authorization": `Bearer ${config.HEROKU_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    console.log("✅ Bot restarted on Heroku.");
  } catch (error) {
    console.error("❌ Failed to restart bot on Heroku:", error);
  }
}

export default update;
