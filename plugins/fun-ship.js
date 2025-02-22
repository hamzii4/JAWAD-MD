import config from '../config.cjs';

const ship = async (m, gss) => {
  try {
    if (!m.isGroup) return m.reply("❌ This command can only be used in groups.");


    const participants = groupMetadata.participants.map(user => user.id);
    if (participants.length < 2) return m.reply("❌ Not enough members to create a pair.");

    let randomPair;
    do {
      randomPair = participants[Math.floor(Math.random() * participants.length)];
    } while (randomPair === m.sender); // Ensure user is not paired with themselves

    const message = `💘 *Match Found!* 💘\n❤️ @${m.sender.split("@")[0]} + @${randomPair.split("@")[0]}\n💖 Congratulations! 🎉`;

    await gss.sendMessage(m.from, {
      text: message,
      contextInfo: {
        mentionedJid: [m.sender, randomPair],
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: "120363354023106228@newsletter",
          newsletterName: "JawadTechX",
          serverMessageId: 143
        }
      }
    });
  } catch (error) {
    console.error("❌ Error in ship command:", error);
    m.reply("⚠️ An error occurred while processing the command. Please try again.");
  }
};

export default ship;
      
