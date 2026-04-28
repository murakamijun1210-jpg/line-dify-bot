import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';

const app = express();
const port = process.env.PORT || 3000;

const LINE_CHANNEL_ACCESS_TOKEN = '...';
const DIFY_API_KEY = '...';
const DIFY_ENDPOINT = 'https://api.dify.ai/v1/chat-messages';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('LINE × Dify Bot is running!');
});

app.post('/webhook', async (req, res) => {
  try {
    const events = req.body.events;
    res.status(200).end();

    if (!events || events.length === 0) return;

    for (const event of events) {
      if (event.type !== 'message' || event.message.type !== 'text') {
        continue;
      }

      const userMessage = event.message.text;
      const replyToken = event.replyToken;

      const difyResponse = await callDify(userMessage);

      let replyText =
        difyResponse ||
        'すみません、少し混み合っているようです。もう一度試してみてください。';

      const NEED_STAFF_TAG = '#要スタッフ対応';
      if (replyText.includes(NEED_STAFF_TAG)) {
        await notifySlack({
          userMessage,
          difyReply: replyText
        });

        replyText = replyText.replace(NEED_STAFF_TAG, '');
      }

      await replyToLine(replyToken, replyText);
    }
  } catch (error) {
    console.error('Webhook error:', error.response?.data || error.message);
  }
});

async function callDify(userMessage) { /* そのまま */ }

async function notifySlack({ userMessage, difyReply }) { /* 追加した関数 */ }

async function replyToLine(replyToken, text) { /* そのまま */ }

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});