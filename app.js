import express from 'express';
import dotenv from "dotenv";
import cookieParser from 'cookie-parser';
import AccountsRouter from './src/routes/accounts.router.js';
import GameRouter from './src/routes/game.router.js';

dotenv.config();

const app = express();
const PORT = 3018;

app.use(express.json());
app.use(express.urlencoded({enxtended:false}));
app.use(cookieParser());
app.use('/api', [AccountsRouter, GameRouter]);

app.listen(PORT, () => {
  console.log(PORT, '포트로 서버가 열렸어요!');
});