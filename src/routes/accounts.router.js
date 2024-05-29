//./routes/account.router.js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../src/utils/prisma/index.js"; // 실제 경로로 수정
import authMiddleware from "../src/middlewares/auth.middleware.js";

const router = express.Router();


//사용자 생성 API
router.post('/sign-up', async (req, res, next) => {
  try {
    // 정보를 가져와서 저장
    const { email, password, name, age, gender } = req.body;

    // 동일 이메일 차단
    const isExistAccount = await prisma.account.findFirst({
      where: { email },
    });

    if (isExistAccount) {
      return res.status(409).json({ message: '이미 가입된 이메일 입니다.' });
    }

    // 사용자 생성
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.account.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    return res.status(201).json({ message: '회원가입이 완료되었습니다.', user }); // user 객체 추가
  } catch (error) {
    console.error(error); // 오류 로그 기록
    return res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
  }
});

//사용자 로그인 api

router.post('/sign-in',async(req,res,next)=>
{
    const {email, password} = req.body;
    const account = await prisma.account.findFirst({where:{email}});
    if(!account){
        return res.status(401).json({message: '존재하지않는 이메일 입니다'});
    }

    if(!await bcrypt.compare(password, account.password)){
        return res.status(401).json({message: '비밀번호가 일치하지 않습니다'});
    }
    const token = jwt.sign({
        accountId: account.accountId,
    },
    'customized_secret_key',//비밀키, 추후 env로 교체
)
    res.cookie('authorization',`Bearer ${token}`);
    return res.status(200).json({message: '로그인 성공했습니다.'});
});

/*사용자 조회 API */
router.get('/accounts', authMiddleware, async(req,res,next)=>{
  //1. 클라이언트가 로그인된 사용자인지 검증한다.
  const {accountId} = req.account;

  //2. 계정을 조회할 때, 1:N관계를 맺고 있는 캐릭터들을 조회
  const account = await prisma.account.findUnique({
    where: { accountId: +accountId },
    select: {
    accountId: true,
    email: true,
    createdAt: true,
    updatedAt: true,
    }
  })
})

export default router;
