//./routes/account.router.js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { accountDataClient as prisma } from "../utils/prisma/index.js";
import { gameDataClient } from "../utils/prisma/index.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

//구매 api가 작동을 안해서..계속 작업하려고 합니다..
router.post("/character/:characterId/purchase", authMiddleware,async(req,res)=>{
  const characterId = parseInt(req.params.characterId, 10);
  const accountId = req.account.id;
  const itemsToPurchase = req.body;
  try{
    const character = await prisma.character.findFirst({
      where:{
        id: characterId,
        accountId: accountId,
      },
    });
    if(!character){
      return res.status(403).json({message:"내 캐릭터가 아닙니다."}); 
    }
    let totalCost = 0;
    
    for(const item of itemsToPurchase){
      const{item_code, count} = item;
      const itemInfo = await gameDataClient.item.findUnique({
        where: {item_code},
        select: {item_price:true},
      });
      if(!itemInfo){
        return res.status(404).json({message:`아이템 코드 ${item_code}를 찾을 수 없습니다`});
      }
      totalCost += itemInfo.item_price * count;
    }
    if (character.money < totalCost){
      return res.status(400).json({message:"게임머니가 부족합니다."});
    }
    await prisma.$transaction(async (prisma)=>{
      for(const item of itemsToPurchase){
        const {item_code,count}=item;
        await prisma.characterInventory.createMany({
          data: Array(count).fill({
            characterId,
            itemId : item_code,
          }),
        });
      }
      await prisma.character.update({
        where:{id:characterId},
        data:{money:{decrement:totalCost}},
      });
    });
    const updatedCharacter = await prisma.character.findUnique({
      where: {id:characterId},
      select: {money: true},
    });
    return res.status(200).json({
      message:"아이템을 구매했습니다.",
      money: updatedCharacter.money,
    });
  }catch(error){
    console.error("아이템 구입 중 에러 발생:",error);
    return res.status(500).json({
      message: "아이템 구입 중 오류가 발생했습니다."});
  } 
})

const validateEmail = email => {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return emailRegex.test(email);
};

//사용자 생성 API
router.post("/sign-up", async (req, res, next) => {
  try {
    // 정보를 가져와서 저장
    const { email, password, confirmedPassword, name } = req.body;

    if (!email || !password || !confirmedPassword || !name) {
      return res.status(400).json({ message: "필수 필드가 누락되었습니다." });
    }
    // 동일 이메일 차단
    const isExistAccount = await prisma.account.findFirst({
      where: { email },
    });

    if (isExistAccount) {
      return res.status(409).json({ message: "이미 가입된 이메일 입니다." });
    }
    if (password !== confirmedPassword) {
      return res.status(400).json({ message: "비밀번호가 일치하지 않습니다." });
    }
    // 이메일 형식 검증
    if (!validateEmail(email)) {
      return res
        .status(400)
        .json({ message: "유효한 이메일 주소를 입력하세요." });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "비밀번호가 6자 이상이어야합니다." });
    }

    // 사용자 생성
    const hashedPassword = await bcrypt.hash(password, 10);
    const account = await prisma.account.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    return res
      .status(201)
      .json({ message: "회원가입이 완료되었습니다.", account }); // account 객체 추가
  } catch (error) {
    console.error(error); // 오류 로그 기록
    return res
      .status(500)
      .json({ message: "서버 오류가 발생했습니다.", error: error.message });
  }
});

//사용자 로그인 api

router.post("/sign-in", async (req, res, next) => {
  const { email, password } = req.body;
  const account = await prisma.account.findFirst({ where: { email } });
  if (!account) {
    return res.status(401).json({ message: "존재하지않는 이메일 입니다" });
  }

  if (!(await bcrypt.compare(password, account.password))) {
    return res.status(401).json({ message: "비밀번호가 일치하지 않습니다" });
  }
  const token = jwt.sign(
    {
      accountId: account.accountId,
    },
    "customized_secret_key" //비밀키, 추후 env로 교체
  );
  res.cookie("authorization", `Bearer ${token}`);
  return res.status(200).json({ message: "로그인 성공했습니다." });
});

/*사용자 조회 API */
router.get("/accounts", authMiddleware, async (req, res, next) => {
  //1. 클라이언트가 로그인된 사용자인지 검증한다.
  const { accountId } = req.account;

  //2. 계정을 조회할 때, 1:N관계를 맺고 있는 캐릭터들을 조회
  const account = await prisma.account.findUnique({
    where: { accountId: +accountId },
    select: {
      accountId: true,
      email: true,
      createdAt: true,
      updatedAt: true,
    },
  });
});

//character 생성 api
router.post("/character", authMiddleware, async (req, res, next) => {
  const { name } = req.body;
  const accountId = req.account.accountId;

  try {
    const isExistCharacterName = await prisma.character.findUnique({
      where: { name },
    });
    if (isExistCharacterName) {
      return res
        .status(409)
        .json({ message: "이미 존재하는 캐릭터 명입니다." });
    }
    const newCharacter = await prisma.character.create({
      data: {
        name,
        accountId,
        health: 500,
        money: 10000,
        inventories: {
          create: [],
        },
      },
      include: {
        inventories: true,
        equippedItems: true,
      },
    });

    return res.status(201).json({ id: newCharacter.characterId });
  } catch (error) {
    console.error("캐릭터 생성 중 에러 발생:", error);
    return res
      .status(500)
      .json({ message: "캐릭터 생성중 오류가 발생했습니다." });
  }
});

//캐릭터 삭제 api
router.delete("/character/:id", authMiddleware, async (req, res) => {
  const characterId = +req.params.id;
  const accountId = req.accountId;
  try {
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      include: { account: true },
    });
    if (!character) {
      return res.status(404).json({ message: "캐릭터를 찾을 수 없습니다." });
    }
    if (character.accountId !== accountId) {
      return res
        .status(403)
        .json({ message: "해당 캐릭터를 삭제할 권한이 없습니다." });
    }
    await prisma.character.delete({
      where: { id: characterId },
    });
    return res
      .status(200)
      .json({ message: "캐릭터가 성공적으로 삭제되었습니다." });
  } catch (error) {
    console.error("캐릭터 삭제 중 에러 발생:", error);
    return res
      .status(500)
      .json({ message: "캐릭터 삭제중 오류가 발생했습니다." });
  }
});

//5 캐릭터 상세 조회 api, 내캐릭터 돈은 볼 수 있고 다른 사람은 안보여야한다.

router.get("/character/:id", authMiddleware, async (req, res) => {
  const characterId = parseInt(req.params.id, 10);
  const accountId = req.account.accountId;
  try {
    const character = await prisma.character.findUnique({
      where: {characterId:characterId },
      include: {
        account: true,
        inventories: true,
        equippedItems: true,
      },
    });

    if (!character) {
      return res.status(404).json({ message: "캐릭터를 찾을 수 없습니다." });
    }

    const isOwner = character.accountId === accountId;

    const characterData = {
      name: character.name,
      health: character.health,
      power: character.power,
    };
    if (isOwner) {
      characterData.money = character.money;
    }
    return res.status(200).json(characterData);
  } catch (error) {
    console.log("캐릭터 조회 중 에러 발생:", error);
    return res
      .status(500)
      .json({ message: "캐릭터 조회 중 오류가 발생했습니다." });
  }
});
export default router;
