import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';

const app = express();
const port = process.env.PORT || 3000;

// ▼▼▼ ここを書き換えてね ▼▼▼
const LINE_CHANNEL_ACCESS_TOKEN = 'DuAeExZeNhEfZVAc6WJdyfivBmOHxIH1xc+SR/xZgmtEis3rVdn320c2K/rsWdl/4B+kUTNQC9OOYXAuTVdJYX1BY/KdUbppHC1co1ng+3OHZH0tRK3ZrkhIsU+VTH3v+9id9yiKNogLICcSeu6nawdB04t89/1O/w1cDnyilFU=';
const DIFY_API_KEY = 'app-fDzmyPXruuqLhSw4tCqLfye7';
const DIFY_ENDPOINT = 'https://api.dify.ai/v1/chat-messages';
// ▲▲▲ ここを書き換えてね ▲▲▲

// JSONボディをパース
app.use(bodyParser.json());

// 動作確認用
app.get('/', (req, res) => {
  res.send('LINE × Dify Bot is running!');
});

// LINEのWebhook受信エンドポイント
app.post('/webhook', async (req, res) => {
  try {
    const events = req.body.events;

    // 応答をすぐ返しておかないとLINE側がタイムアウトするので先に200を返す
    res.status(200).end();

    if (!events || events.length === 0) return;

    for (const event of events) {
      if (event.type !== 'message' || event.message.type !== 'text') {
        continue; // テキスト以外は無視
      }

      const userMessage = event.message.text;
      const replyToken = event.replyToken;

      // 1. Difyにユーザーメッセージを送る
      const difyResponse = await callDify(userMessage);

      const replyText =
        difyResponse ||
        'すみません、少し混み合っているようです。もう一度試してみてください。';

      // 2. LINEに返信する
      await replyToLine(replyToken, replyText);
    }
  } catch (error) {
    console.error('Webhook error:', error.response?.data || error.message);
  }
});

// Dify APIを呼び出す関数
async function callDify(userMessage) {
  try {
    const response = await axios.post(
      DIFY_ENDPOINT,
      {
        inputs: {},
        query: userMessage,
        response_mode: 'blocking',
        user: 'line-user'
      },
      {
        headers: {
          Authorization: `Bearer ${DIFY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // 返り値の形式は、Difyのエンドポイント種類によって変わるので、
    // よくある "answer" フィールドから取る形の例
    const data = response.data;
    if (data.answer) {
      return data.answer;
    }

    // 必要に応じてログを見て、構造を調整
    console.log('Dify response:', JSON.stringify(data, null, 2));
    return '（Difyからの返答の形式を確認してください）';
  } catch (error) {
    console.error('Dify API error:', error.response?.data || error.message);
    return null;
  }
}

// LINEに返信する関数
async function replyToLine(replyToken, text) {
  try {
    await axios.post(
      'https://api.line.me/v2/bot/message/reply',
      {
        replyToken,
        messages: [
          {
            type: 'text',
            text
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
        }
      }
    );
  } catch (error) {
    console.error('LINE reply error:', error.response?.data || error.message);
  }
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});