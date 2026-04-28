import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';

const app = express();
const port = process.env.PORT || 3000;

const LINE_CHANNEL_ACCESS_TOKEN = 'DuAeExZeNhEfZVAc6WJdyfivBmOHxIH1xc+SR/xZgmtEis3rVdn320c2K/rsWdl/4B+kUTNQC9OOYXAuTVdJYX1BY/KdUbppHC1co1ng+3OHZH0tRK3ZrkhIsU+VTH3v+9id9yiKNogLICcSeu6nawdB04t89/1O/w1cDnyilFU=';
const DIFY_API_KEY = 'app-fDzmyPXruuqLhSw4tCqLfye7';
const DIFY_ENDPOINT = 'https://api.dify.ai/v1/chat-messages';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

app.use(bodyParser.json());

// 動作確認用
app.get('/', (req, res) => {
  res.send('LINE × Dify Bot is running!');
});

// LINEのWebhook受信エンドポイント
app.post('/webhook', async (req, res) => {
  try {
    const events = req.body.events;

    // 先に200を返す（LINEのタイムアウト回避）
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

      let replyText =
        difyResponse ||
        'すみません、少し混み合っているようです。もう一度試してみてください。';

      // 2. 「#要スタッフ対応」が含まれているかチェック
      const NEED_STAFF_TAG = '#要スタッフ対応';
      if (replyText.includes(NEED_STAFF_TAG)) {
        // Slackに通知（失敗してもBot全体が止まらないようにtry/catchでガード）
        try {
          await notifySlack({
            userMessage,
            difyReply: replyText
          });
        } catch (e) {
          console.error('notifySlack inner error:', e);
        }

        // ユーザーにはタグを見せたくない場合は削除
        replyText = replyText.replace(NEED_STAFF_TAG, '');
      }

      // 3. LINEに返信する
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

    const data = response.data;
    if (data.answer) {
      return data.answer;
    }

    console.log('Dify response:', JSON.stringify(data, null, 2));
    return '（Difyからの返答の形式を確認してください）';
  } catch (error) {
    console.error('Dify API error:', error.response?.data || error.message);
    return null;
  }
}

// Slackに通知する関数
async function notifySlack({ userMessage, difyReply }) {
  if (!SLACK_WEBHOOK_URL) {
    console.warn('SLACK_WEBHOOK_URL is not set. Skip Slack notification.');
    return;
  }

  const payload = {
    text: [
      '*#要スタッフ対応 のメッセージが届きました*',
      '',
      '*ユーザーの質問:*',
      `> ${userMessage}`,
      '',
      '*Difyの回答（参考）:*',
      `> ${difyReply}`,
      '',
      '_対応後はこのスレッドで「対応済み」などを共有してください_'
    ].join('\n')
  };

  try {
    await axios.post(SLACK_WEBHOOK_URL, payload);
  } catch (error) {
    console.error('Slack notify error:', error.response?.data || error.message);
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